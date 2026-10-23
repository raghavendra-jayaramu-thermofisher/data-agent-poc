"""A compact, one-line-per-object text form of a knowledge version's table schemas.

Table documents store their columns only as the Markdown that `builder.build_table_document`
renders, so this reads that fixed format back: column rows, the primary key, and foreign keys.
"""

from __future__ import annotations

import re
from collections.abc import Iterable

from app.knowledge.models import KnowledgeDocument

_COLUMN_ROW = re.compile(
    r"^\| `(?P<name>.+?)` \| `(?P<type>.+?)` \| (?P<nullable>yes|no|unknown) \|"
)
_FOREIGN_KEY = re.compile(r"^- `(?P<columns>.+?)` → `(?P<target>.+?)`$")
_COLLATION = re.compile(r"\s+COLLATE\s+\"[^\"]*\"", re.IGNORECASE)
_PLAIN_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _identifier(name: str) -> str:
    return name if _PLAIN_IDENTIFIER.match(name) else f"[{name.replace(']', ']]')}]"


def _section(lines: list[str], heading: str) -> list[str]:
    try:
        start = lines.index(heading) + 1
    except ValueError:
        return []
    section: list[str] = []
    for line in lines[start:]:
        if line.startswith("## "):
            break
        if line.strip():
            section.append(line.strip())
    return section


def compact_table(document: KnowledgeDocument) -> str:
    metadata = document.metadata_json or {}
    schema, table = metadata.get("schema"), metadata.get("table")
    name = (
        f"{_identifier(str(schema))}.{_identifier(str(table))}"
        if schema
        else _identifier(str(table or document.document_key))
    )
    lines = document.content_markdown.splitlines()
    columns = []
    for line in _section(lines, "## Columns"):
        row = _COLUMN_ROW.match(line)
        if row:
            column_type = _COLLATION.sub("", row["type"]).strip()
            required = " NOT NULL" if row["nullable"] == "no" else ""
            columns.append(f"{_identifier(row['name'])} {column_type}{required}")
    parts = [", ".join(columns) or "no columns reported"]
    primary_key = [str(value) for value in metadata.get("primary_key") or []]
    if primary_key:
        parts.append(f"PK({', '.join(_identifier(value) for value in primary_key)})")
    for line in _section(lines, "## Foreign keys"):
        foreign_key = _FOREIGN_KEY.match(line)
        if foreign_key:
            parts.append(f"FK({foreign_key['columns']})->{foreign_key['target']}")
    object_type = metadata.get("object_type") or "table"
    return f"{name} ({object_type}): " + "; ".join(parts)


def compact_schema(source_name: str, documents: Iterable[KnowledgeDocument]) -> tuple[str, int]:
    """The schema text and the number of tables and views it describes."""
    tables = sorted(
        (item for item in documents if item.document_type == "table_schema"),
        key=lambda item: item.document_key.casefold(),
    )
    header = [
        f"-- {source_name}: {len(tables)} tables and views",
        "-- name (type): column TYPE [NOT NULL], ...; PK(...); FK(columns)->table(columns)",
    ]
    return "\n".join([*header, *(compact_table(item) for item in tables)]) + "\n", len(tables)
