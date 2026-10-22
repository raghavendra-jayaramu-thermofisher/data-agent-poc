"""Paged reads of stored table artifacts.

A table artifact stores at most `agent_result_max_rows` rows. Browsers receive only the first page
in the execution trace and request further pages here. Stored rows never change after the job
finishes, so an offset into the sorted and filtered rows is a stable position; the cursor is still
signed and bound to the artifact, sort and search so it cannot be replayed against another view.
"""

from __future__ import annotations

import re
import uuid
from collections.abc import Sequence
from decimal import Decimal, InvalidOperation

from pydantic import BaseModel, Field

from app.core.config import Settings
from app.core.errors import AppError
from app.core.pagination import CursorCodec

TRACE_TABLE_ROWS = 200
DEFAULT_TABLE_PAGE_SIZE = 200
MAX_TABLE_PAGE_SIZE = 1000

_NATURAL_CHUNKS = re.compile(r"(\d+)")


class TableRowsInfo(BaseModel):
    """Paging state for a table artifact whose rows are trimmed in the execution trace."""

    stored_row_count: int
    next_cursor: str | None
    has_more: bool


class TableRowsPage(BaseModel):
    columns: list[str]
    rows: list[list[object]]
    matching_count: int
    next_cursor: str | None
    has_more: bool


class TableView(BaseModel):
    sort: str | None = Field(default=None, max_length=512)
    descending: bool = False
    search: str = Field(default="", max_length=240)


def stored_table(payload: dict[str, object]) -> tuple[list[str], list[list[object]]]:
    columns, rows = payload.get("columns"), payload.get("rows")
    if (
        payload.get("schema_version") != 1
        or not isinstance(columns, list)
        or not all(isinstance(column, str) for column in columns)
        or not isinstance(rows, list)
        or not all(isinstance(row, list) for row in rows)
    ):
        raise AppError("TABLE_ARTIFACT_INVALID", "The stored table is invalid.", 422)
    return columns, rows


def _number(value: object) -> Decimal | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        return Decimal(str(value))
    if isinstance(value, str):
        try:
            return Decimal(value.strip()) if value.strip() else None
        except InvalidOperation:
            return None
    return None


def _sort_key(value: object) -> tuple:
    """Numbers (including decimal text) by value, then text in natural case-insensitive order."""
    number = _number(value)
    if number is not None and number.is_finite():
        return (0, number)
    text = str(value).casefold()
    return (1, tuple(int(part) if part.isdigit() else part for part in _NATURAL_CHUNKS.split(text)))


def _matches(row: Sequence[object], needle: str) -> bool:
    return any(value is not None and needle in str(value).casefold() for value in row)


def table_view_rows(
    columns: list[str], rows: list[list[object]], view: TableView
) -> list[list[object]]:
    """Filter and sort like the browser table; empty cells always sort last."""
    needle = view.search.strip().casefold()
    selected = [row for row in rows if _matches(row, needle)] if needle else list(rows)
    if view.sort is None:
        return selected
    try:
        index = columns.index(view.sort)
    except ValueError as exc:
        raise AppError("TABLE_SORT_INVALID", "The sort column is not in this table.", 400) from exc
    present = [row for row in selected if index < len(row) and row[index] is not None]
    empty = [row for row in selected if index >= len(row) or row[index] is None]
    present.sort(key=lambda row: _sort_key(row[index]), reverse=view.descending)
    return present + empty


def _codec(settings: Settings, organization_id: uuid.UUID, artifact_id: uuid.UUID, view: TableView):
    return CursorCodec(
        settings,
        "table-rows",
        organization_id,
        artifact_id,
        view.sort,
        view.descending,
        view.search.strip().casefold(),
    )


def first_page_info(
    settings: Settings,
    organization_id: uuid.UUID,
    artifact_id: uuid.UUID,
    stored_row_count: int,
) -> TableRowsInfo:
    has_more = stored_row_count > TRACE_TABLE_ROWS
    codec = _codec(settings, organization_id, artifact_id, TableView())
    return TableRowsInfo(
        stored_row_count=stored_row_count,
        next_cursor=codec.encode([TRACE_TABLE_ROWS]) if has_more else None,
        has_more=has_more,
    )


def table_rows_page(
    settings: Settings,
    organization_id: uuid.UUID,
    artifact_id: uuid.UUID,
    payload: dict[str, object],
    view: TableView,
    *,
    cursor: str | None,
    limit: int,
) -> TableRowsPage:
    columns, rows = stored_table(payload)
    codec = _codec(settings, organization_id, artifact_id, view)
    offset = int(codec.decode(cursor, [int])[0]) if cursor else 0
    if offset < 0:
        raise AppError("INVALID_CURSOR", "The page cursor is invalid.", 400)
    selected = table_view_rows(columns, rows, view)
    page = selected[offset : offset + limit]
    end = offset + len(page)
    has_more = end < len(selected)
    return TableRowsPage(
        columns=columns,
        rows=page,
        matching_count=len(selected),
        next_cursor=codec.encode([end]) if has_more else None,
        has_more=has_more,
    )
