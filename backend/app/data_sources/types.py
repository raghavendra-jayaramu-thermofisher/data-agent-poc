from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time
from decimal import Decimal
from typing import TypeAlias

ScalarValue: TypeAlias = str | int | float | bool | Decimal | date | datetime | time | None


@dataclass(frozen=True, slots=True)
class ColumnMetadata:
    name: str
    native_type: str
    nullable: bool | None
    default: str | None = None


@dataclass(frozen=True, slots=True)
class ForeignKeyMetadata:
    constrained_columns: tuple[str, ...]
    referred_schema: str | None
    referred_table: str
    referred_columns: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class TableMetadata:
    schema: str | None
    name: str
    object_type: str
    columns: tuple[ColumnMetadata, ...]
    primary_key: tuple[str, ...] = ()
    foreign_keys: tuple[ForeignKeyMetadata, ...] = ()


@dataclass(frozen=True, slots=True)
class SchemaMetadata:
    tables: tuple[TableMetadata, ...]


@dataclass(frozen=True, slots=True)
class QueryResult:
    columns: tuple[str, ...]
    rows: tuple[tuple[object, ...], ...]
    truncated: bool


@dataclass(frozen=True, slots=True)
class ConnectionTestResult:
    ok: bool
    details: dict[str, object] = field(default_factory=dict)
