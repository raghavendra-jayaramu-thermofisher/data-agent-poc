from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.data_sources.types import ConnectionTestResult, QueryResult, SchemaMetadata


@runtime_checkable
class DataSourceAdapter(Protocol):
    async def test_connection(self) -> ConnectionTestResult: ...

    async def introspect(self) -> SchemaMetadata: ...

    async def execute_read_query(self, sql: str, *, max_rows: int) -> QueryResult: ...
