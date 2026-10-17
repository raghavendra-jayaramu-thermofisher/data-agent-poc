"""Data-independent matrix artifacts. Values, including totals, come only from SQL."""

from __future__ import annotations

import hashlib
import json
import math
import re
import uuid
from decimal import Decimal, InvalidOperation
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class MatrixError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


class MatrixDimension(BaseModel):
    model_config = ConfigDict(extra="forbid")
    field: str = Field(
        min_length=1, max_length=255, description="Exact SQL output dimension field."
    )
    label: str | None = Field(default=None, max_length=160, description="Display label only.")
    sort_field: str | None = Field(
        default=None,
        max_length=255,
        description="SQL output sort key, constant per hierarchy member.",
    )
    sort_type: Literal["text", "number", "date"] = Field(
        default="text",
        description="Comparison type for the sort key; dates must be ISO dates/times.",
    )
    descending: bool = Field(
        default=False, description="Reverse the deterministic dimension ordering."
    )


class MatrixMeasure(BaseModel):
    model_config = ConfigDict(extra="forbid")
    field: str = Field(
        min_length=1,
        max_length=255,
        description="Exact numeric SQL output measure; includes SQL-calculated totals.",
    )
    label: str | None = Field(default=None, max_length=160, description="Display label only.")
    decimal_places: int = Field(
        default=0,
        ge=0,
        le=12,
        description="Displayed decimal places; source precision is retained.",
    )
    format: Literal["number", "percent"] = Field(
        default="number",
        description="Number or ratio displayed as percent; never changes source values.",
    )


class CreateMatrixArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sql_execution_id: uuid.UUID = Field(description="Successful execute_sql ID from this job.")
    title: str = Field(min_length=1, max_length=240, description="Business-facing matrix title.")
    rows: list[MatrixDimension] = Field(
        min_length=1, max_length=3, description="Row hierarchy, outermost field first."
    )
    columns: list[MatrixDimension] = Field(
        min_length=1, max_length=3, description="Column hierarchy, outermost field first."
    )
    measures: list[MatrixMeasure] = Field(
        min_length=1,
        max_length=4,
        description="Numeric fields shown within each column member; never combined.",
    )
    row_depth_field: str | None = Field(
        default=None,
        max_length=255,
        description=(
            "SQL output integer: number of active row hierarchy fields. Full depth is detail; "
            "0 is all rows; intermediate depths are prefix subtotals. "
            "Use GROUPING flags, not NULLs."
        ),
    )
    column_depth_field: str | None = Field(
        default=None,
        max_length=255,
        description=(
            "SQL output integer: number of active column hierarchy fields. Full depth is detail; "
            "0 is all columns. Supply both depth fields when SQL includes totals."
        ),
    )
    show_row_subtotals: bool = Field(
        default=True, description="Show SQL totals on non-leaf row groups."
    )
    show_row_grand_total: bool = Field(
        default=True, description="Show the SQL total across all row members for each column."
    )
    show_column_subtotals: bool = Field(
        default=False, description="Show SQL totals for column groups and enable column collapse."
    )
    show_column_grand_total: bool = Field(
        default=False, description="Show SQL totals across all column members for each row."
    )
    initial_expansion_depth: int = Field(
        default=1,
        ge=0,
        le=3,
        description="Initial expanded row depth; users can expand or collapse groups.",
    )

    @model_validator(mode="after")
    def validate_mapping(self) -> CreateMatrixArgs:
        fields = [item.field for item in [*self.rows, *self.columns, *self.measures]]
        if len(set(fields)) != len(fields):
            raise ValueError("Row, column and measure fields must be distinct")
        if bool(self.row_depth_field) != bool(self.column_depth_field):
            raise ValueError("Supply both depth fields or neither")
        if self.row_depth_field == self.column_depth_field and self.row_depth_field:
            raise ValueError("Depth fields must be distinct")
        if any(field in fields for field in (self.row_depth_field, self.column_depth_field)):
            raise ValueError("Depth fields cannot be dimension or measure fields")
        needs_totals = (
            (self.show_row_subtotals and len(self.rows) > 1)
            or self.show_row_grand_total
            or (self.show_column_subtotals and len(self.columns) > 1)
            or self.show_column_grand_total
        )
        if needs_totals and not self.row_depth_field:
            raise ValueError("Requested totals require SQL-provided row and column depth fields")
        return self


class MatrixViewState(BaseModel):
    model_config = ConfigDict(extra="forbid")
    collapsed_rows: list[Annotated[str, Field(pattern=r"^r[a-f0-9]{24}$")]] = Field(
        default_factory=list, max_length=5000
    )
    collapsed_columns: list[Annotated[str, Field(pattern=r"^c[a-f0-9]{24}$")]] = Field(
        default_factory=list, max_length=5000
    )


_DECIMAL = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$")


def decimal_value(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float, str, Decimal)):
        raise MatrixError("MATRIX_VALUE_INVALID", "Measures must be finite numbers or NULL.")
    raw = str(value)
    if len(raw) > 128 or not _DECIMAL.fullmatch(raw):
        raise MatrixError("MATRIX_VALUE_INVALID", "Measures must be finite decimal numbers.")
    try:
        number = Decimal(raw)
    except InvalidOperation as exc:
        raise MatrixError("MATRIX_VALUE_INVALID", "Invalid numeric measure.") from exc
    if not number.is_finite() or abs(number.adjusted()) > 100:
        raise MatrixError("MATRIX_VALUE_INVALID", "Numeric measure is outside supported precision.")
    return format(number, "f")


def _scalar(value: object) -> object:
    if value is None or isinstance(value, (str, bool, int)):
        if isinstance(value, str) and len(value) > 512:
            raise MatrixError("MATRIX_DIMENSION_INVALID", "Dimension labels exceed 512 characters.")
        return value
    if isinstance(value, float) and math.isfinite(value):
        return value
    raise MatrixError("MATRIX_DIMENSION_INVALID", "Dimensions must be scalar SQL values.")


def _key(path: list[object]) -> str:
    # Type tags keep SQL NULL, literal labels, booleans and numeric strings distinct.
    return json.dumps([(type(value).__name__, value) for value in path], ensure_ascii=False)


def _id(axis: str, path: list[object]) -> str:
    return axis + hashlib.sha256(_key(path).encode()).hexdigest()[:24]


def _sort_value(value: object, dimension: MatrixDimension) -> tuple[int, object]:
    if value is None:
        return (1, "")
    if dimension.sort_type == "number":
        return (0, Decimal(decimal_value(value) or "0"))
    if dimension.sort_type == "date":
        from datetime import UTC, datetime

        try:
            # ISO SQL dates/timestamps provide a deterministic calendar ordering.
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError as exc:
            raise MatrixError("MATRIX_SORT_INVALID", "Use an ISO date/time sort field.") from exc
        return (0, parsed.replace(tzinfo=parsed.tzinfo or UTC).timestamp())
    return (0, str(value).casefold())


def build_matrix(
    spec: CreateMatrixArgs,
    columns: list[str],
    rows: list[list[object]],
    *,
    truncated: bool = False,
    max_nodes: int = 5000,
    max_columns: int = 100,
    max_cells: int = 100000,
    max_bytes: int = 10_000_000,
) -> dict[str, object]:
    if truncated:
        raise MatrixError(
            "MATRIX_SOURCE_TRUNCATED", "Run a smaller complete aggregate query first."
        )
    if len(columns) != len(set(columns)) or not all(isinstance(name, str) for name in columns):
        raise MatrixError("MATRIX_SOURCE_INVALID", "SQL output columns must have unique names.")
    required = {item.field for item in [*spec.rows, *spec.columns, *spec.measures]}
    required |= {item.sort_field for item in [*spec.rows, *spec.columns] if item.sort_field}
    required |= {field for field in (spec.row_depth_field, spec.column_depth_field) if field}
    if not required.issubset(columns):
        raise MatrixError("MATRIX_FIELD_NOT_FOUND", "Use exact output fields from the SQL result.")
    if any(not isinstance(row, list) or len(row) != len(columns) for row in rows):
        raise MatrixError("MATRIX_SOURCE_INVALID", "SQL rows do not match their output columns.")
    records = [dict(zip(columns, row, strict=True)) for row in rows]
    nodes: dict[str, dict[str, object]] = {}
    sorts: dict[str, tuple[int, object]] = {}
    cells: dict[tuple[str, str], list[str | None]] = {}
    leaf_paths: list[tuple[list[object], list[object]]] = []
    raw_cells: list[tuple[list[object], list[object], list[str | None]]] = []

    def path_for(record: dict[str, object], dimensions: list[MatrixDimension], field: str | None):
        depth = record[field] if field else len(dimensions)
        if type(depth) is not int or not 0 <= depth <= len(dimensions):
            raise MatrixError("MATRIX_DEPTH_INVALID", "SQL depth fields must be valid integers.")
        return [_scalar(record[item.field]) for item in dimensions[:depth]]

    def add_nodes(
        path: list[object], dimensions: list[MatrixDimension], record: dict[str, object], axis: str
    ):
        for depth in range(1, len(path) + 1):
            prefix = path[:depth]
            node_id = _id(axis, prefix)
            dimension = dimensions[depth - 1]
            sort = _sort_value(record[dimension.sort_field or dimension.field], dimension)
            if node_id in sorts and sorts[node_id] != sort:
                raise MatrixError(
                    "MATRIX_SORT_CONFLICT", "A hierarchy member has conflicting sort values."
                )
            sorts[node_id] = sort
            nodes[node_id] = {
                "id": node_id,
                "parent_id": _id(axis, prefix[:-1]) if depth > 1 else None,
                "depth": depth,
                "path": prefix,
                "label": "(Blank)" if prefix[-1] is None else str(prefix[-1]),
            }
            if len(nodes) > max_nodes:
                raise MatrixError("MATRIX_TOO_LARGE", "Reduce matrix hierarchy cardinality.")

    for record in records:
        rp = path_for(record, spec.rows, spec.row_depth_field)
        cp = path_for(record, spec.columns, spec.column_depth_field)
        values = [decimal_value(record[item.field]) for item in spec.measures]
        raw_cells.append((rp, cp, values))
        if len(rp) == len(spec.rows) and len(cp) == len(spec.columns):
            leaf_paths.append((rp, cp))
            add_nodes(rp, spec.rows, record, "r")
            add_nodes(cp, spec.columns, record, "c")

    row_depths = {len(spec.rows)}
    column_depths = {len(spec.columns)}
    if spec.show_row_subtotals:
        row_depths.update(range(1, len(spec.rows)))
    if spec.show_row_grand_total:
        row_depths.add(0)
    if spec.show_column_subtotals:
        column_depths.update(range(1, len(spec.columns)))
    if spec.show_column_grand_total:
        column_depths.add(0)
    if leaf_paths and spec.show_row_grand_total:
        nodes[_id("r", [])] = {
            "id": _id("r", []),
            "parent_id": None,
            "depth": 0,
            "path": [],
            "label": "Grand total",
        }
    if leaf_paths and spec.show_column_grand_total:
        nodes[_id("c", [])] = {
            "id": _id("c", []),
            "parent_id": None,
            "depth": 0,
            "path": [],
            "label": "Grand total",
        }
    expected: set[tuple[str, str]] = set()
    if len(nodes) > max_nodes:
        raise MatrixError("MATRIX_TOO_LARGE", "Reduce matrix hierarchy cardinality.")
    for rp, cp in leaf_paths:
        for rd in row_depths:
            for cd in column_depths:
                expected.add((_id("r", rp[:rd]), _id("c", cp[:cd])))
                if len(expected) * len(spec.measures) > max_cells:
                    raise MatrixError("MATRIX_TOO_LARGE", "Reduce the number of matrix cells.")
    seen: set[tuple[str, str]] = set()
    for rp, cp, values in raw_cells:
        key = (_id("r", rp), _id("c", cp))
        if key in seen:
            raise MatrixError(
                "MATRIX_DUPLICATE_CELL",
                "Aggregate SQL to one row per coordinate and subtotal scope.",
            )
        seen.add(key)
        # SQL may return unrequested subtotal levels. Never combine them with detail values.
        if len(rp) in row_depths and len(cp) in column_depths:
            if key not in expected:
                raise MatrixError(
                    "MATRIX_SOURCE_INVALID", "A subtotal has no corresponding detail cells."
                )
            cells[key] = values
    if expected - cells.keys():
        raise MatrixError(
            "MATRIX_TOTALS_MISSING",
            "Return every requested subtotal from SQL, with explicit depth flags.",
        )

    def ordered(axis: str, dimensions: list[MatrixDimension]) -> list[dict[str, object]]:
        output: list[dict[str, object]] = []
        by_parent: dict[object, list[dict[str, object]]] = {}
        for node in nodes.values():
            if str(node["id"]).startswith(axis) and node["depth"] != 0:
                by_parent.setdefault(node["parent_id"], []).append(node)

        def visit(parent: str | None, depth: int):
            children = by_parent.get(parent, [])
            children.sort(
                key=lambda n: (sorts[str(n["id"])], str(n["id"])),
                reverse=dimensions[depth - 1].descending,
            )
            for node in children:
                output.append(node)
                if depth < len(dimensions):
                    visit(str(node["id"]), depth + 1)

        visit(None, 1)
        if _id(axis, []) in nodes:
            output.append(nodes[_id(axis, [])])
        return output

    row_nodes, column_nodes = ordered("r", spec.rows), ordered("c", spec.columns)
    value_columns = len(column_nodes) * len(spec.measures)
    if value_columns > max_columns or len(row_nodes) * value_columns > max_cells:
        raise MatrixError("MATRIX_TOO_LARGE", "Reduce matrix rows, columns, or measures.")
    payload: dict[str, object] = {
        "schema_version": 1,
        "renderer": "frontend",
        "totals_source": "sql",
        "source_sql_execution_id": str(spec.sql_execution_id),
        "spec": spec.model_dump(mode="json"),
        "row_nodes": row_nodes,
        "column_nodes": column_nodes,
        "cells": [
            {"row_id": r, "column_id": c, "values": values}
            for (r, c), values in sorted(cells.items())
        ],
        "source_row_count": len(rows),
        "source_digest": hashlib.sha256(
            json.dumps([columns, rows], ensure_ascii=False, separators=(",", ":")).encode()
        ).hexdigest(),
    }
    if len(json.dumps(payload, ensure_ascii=False).encode()) > max_bytes:
        raise MatrixError("MATRIX_TOO_LARGE", "Matrix artifact exceeds its byte limit.")
    return payload


def validate_stored_matrix(
    payload: dict[str, Any],
    source_id: uuid.UUID,
    table: dict[str, Any],
    *,
    truncated: bool,
) -> bool:
    """Rebuild from persisted source evidence, using absolute supported limits for old artifacts."""
    try:
        spec = CreateMatrixArgs.model_validate(payload.get("spec"))
        return spec.sql_execution_id == source_id and payload == build_matrix(
            spec,
            table["columns"],
            table["rows"],
            truncated=truncated or table.get("stored_result_truncated") is True,
            max_nodes=10000,
            max_columns=256,
            max_cells=200000,
            max_bytes=100_000_000,
        )
    except (ValueError, TypeError, KeyError):
        return False


def matrix_projection(
    payload: dict[str, Any], state: MatrixViewState
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    spec = CreateMatrixArgs.model_validate(payload["spec"])

    def project(
        nodes: list[dict[str, Any]], collapsed: list[str], axis: str
    ) -> list[dict[str, Any]]:
        by_id = {node["id"]: node for node in nodes}
        parents = {node["parent_id"] for node in nodes if node["parent_id"]}
        if len(set(collapsed)) != len(collapsed) or any(item not in parents for item in collapsed):
            raise MatrixError(
                "MATRIX_VIEW_INVALID", "Collapse state contains an unknown or non-group member."
            )
        if axis == "column" and collapsed and not spec.show_column_subtotals:
            raise MatrixError(
                "MATRIX_VIEW_INVALID", "Column collapse requires SQL-provided subtotals."
            )
        output = []
        if axis == "column":
            by_parent: dict[str | None, list[dict[str, Any]]] = {}
            for node in nodes:
                by_parent.setdefault(node["parent_id"], []).append(node)

            def visit(node: dict[str, Any]) -> None:
                if node["id"] not in collapsed:
                    for child in by_parent.get(node["id"], []):
                        visit(child)
                if node["id"] not in parents or spec.show_column_subtotals:
                    output.append(node)

            for root in by_parent.get(None, []):
                visit(root)
            return output
        for node in nodes:
            ancestor = node["parent_id"]
            hidden = False
            while ancestor:
                if ancestor in collapsed:
                    hidden = True
                    break
                ancestor = by_id[ancestor]["parent_id"]
            if not hidden:
                if axis == "row" or node["id"] not in parents or spec.show_column_subtotals:
                    output.append(node)
        return output

    return project(payload["row_nodes"], state.collapsed_rows, "row"), project(
        payload["column_nodes"], state.collapsed_columns, "column"
    )
