from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass

from app.data_sources.types import ForeignKeyMetadata, SchemaMetadata, TableMetadata


@dataclass(frozen=True, slots=True)
class BuiltDocument:
    document_type: str
    document_key: str
    title: str
    content_markdown: str
    metadata: dict[str, object]
    estimated_tokens: int


@dataclass(frozen=True, slots=True)
class KnowledgeSnapshot:
    schema_fingerprint: str
    index: BuiltDocument
    tables: tuple[BuiltDocument, ...]


def qualified_table_key(table: TableMetadata) -> str:
    return f"{table.schema}.{table.name}" if table.schema else table.name


def estimate_tokens(text: str) -> int:
    # Stable conservative approximation for observability only; it is not provider billing usage.
    return max(1, math.ceil(len(text) / 4))


def _canonical_schema(metadata: SchemaMetadata) -> list[dict[str, object]]:
    result: list[dict[str, object]] = []
    for table in sorted(metadata.tables, key=lambda item: (item.schema or "", item.name, item.object_type)):
        result.append(
            {
                "schema": table.schema,
                "name": table.name,
                "object_type": table.object_type,
                "columns": [
                    {
                        "name": col.name,
                        "native_type": col.native_type,
                        "nullable": col.nullable,
                        "default": col.default,
                    }
                    for col in table.columns
                ],
                "primary_key": list(table.primary_key),
                "foreign_keys": [
                    {
                        "constrained_columns": list(fk.constrained_columns),
                        "referred_schema": fk.referred_schema,
                        "referred_table": fk.referred_table,
                        "referred_columns": list(fk.referred_columns),
                    }
                    for fk in sorted(
                        table.foreign_keys,
                        key=lambda item: (
                            item.referred_schema or "",
                            item.referred_table,
                            item.constrained_columns,
                        ),
                    )
                ],
            }
        )
    return result


def schema_fingerprint(metadata: SchemaMetadata) -> str:
    canonical = json.dumps(
        _canonical_schema(metadata), sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def _foreign_key_line(fk: ForeignKeyMetadata) -> str:
    left = ", ".join(fk.constrained_columns) or "?"
    ref_table = f"{fk.referred_schema}.{fk.referred_table}" if fk.referred_schema else fk.referred_table
    right = ", ".join(fk.referred_columns) or "?"
    return f"- `{left}` → `{ref_table}({right})`"


def build_table_document(table: TableMetadata) -> BuiltDocument:
    key = qualified_table_key(table)
    lines = [f"# {key}", "", f"Object type: **{table.object_type}**", "", "## Columns", ""]
    if table.columns:
        lines.extend(["| Column | Type | Nullable | Default |", "|---|---|---|---|"])
        for col in table.columns:
            default = "" if col.default is None else str(col.default).replace("|", "\\|")
            lines.append(
                f"| `{col.name}` | `{col.native_type}` | "
                f"{'unknown' if col.nullable is None else ('yes' if col.nullable else 'no')} | {default} |"
            )
    else:
        lines.append("No columns were reported by the datasource.")
    lines.extend(["", "## Primary key", ""])
    lines.append(", ".join(f"`{value}`" for value in table.primary_key) if table.primary_key else "None reported.")
    lines.extend(["", "## Foreign keys", ""])
    if table.foreign_keys:
        lines.extend(_foreign_key_line(fk) for fk in table.foreign_keys)
    else:
        lines.append("None reported.")
    content = "\n".join(lines).strip() + "\n"
    metadata: dict[str, object] = {
        "schema": table.schema,
        "table": table.name,
        "object_type": table.object_type,
        "column_count": len(table.columns),
        "primary_key": list(table.primary_key),
        "foreign_key_count": len(table.foreign_keys),
    }
    return BuiltDocument(
        document_type="table_schema",
        document_key=key,
        title=key,
        content_markdown=content,
        metadata=metadata,
        estimated_tokens=estimate_tokens(content),
    )


def build_index(metadata: SchemaMetadata, table_docs: tuple[BuiltDocument, ...]) -> BuiltDocument:
    by_key = {doc.document_key: doc for doc in table_docs}
    lines = ["# Database schema index", "", f"Objects: **{len(metadata.tables)}**", "", "## Tables and views", ""]
    if not metadata.tables:
        lines.append("No user tables or views were found.")
    else:
        for table in sorted(metadata.tables, key=lambda item: (item.schema or "", item.name)):
            key = qualified_table_key(table)
            pk = f"; PK: {', '.join(table.primary_key)}" if table.primary_key else ""
            lines.append(
                f"- `{key}` — {table.object_type}; {len(table.columns)} columns{pk}; "
                f"schema document key: `{by_key[key].document_key}`"
            )
    content = "\n".join(lines).strip() + "\n"
    schemas = sorted({table.schema for table in metadata.tables if table.schema})
    return BuiltDocument(
        document_type="index",
        document_key="index",
        title="Database schema index",
        content_markdown=content,
        metadata={"object_count": len(metadata.tables), "schemas": schemas},
        estimated_tokens=estimate_tokens(content),
    )


def build_snapshot(metadata: SchemaMetadata) -> KnowledgeSnapshot:
    table_docs = tuple(
        build_table_document(table)
        for table in sorted(metadata.tables, key=lambda item: (item.schema or "", item.name, item.object_type))
    )
    return KnowledgeSnapshot(
        schema_fingerprint=schema_fingerprint(metadata),
        index=build_index(metadata, table_docs),
        tables=table_docs,
    )
