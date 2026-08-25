from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import BaseModel

from app.data_sources.adapters.registry import (
    AdapterRegistration,
    DataSourceAdapterRegistry,
    registry,
)
from app.data_sources.errors import DataSourceConfigurationError
from app.data_sources.types import ConnectionTestResult, QueryResult, SchemaMetadata


class FakeConfig(BaseModel):
    label: str


class FakeAdapter:
    async def test_connection(self) -> ConnectionTestResult:
        return ConnectionTestResult(ok=True)

    async def introspect(self) -> SchemaMetadata:
        return SchemaMetadata(tables=())

    async def execute_read_query(self, sql: str, *, max_rows: int) -> QueryResult:
        return QueryResult(columns=(), rows=(), truncated=False)


def test_builtin_adapter_registry_is_explicit_and_extensible() -> None:
    assert registry.supported_kinds() == ("duckdb", "mssql", "mysql", "postgres")

    custom = DataSourceAdapterRegistry()
    custom.register(
        "exampledb",
        AdapterRegistration(
            FakeConfig,
            False,
            lambda _config, _credentials, _path: FakeAdapter(),
        ),
    )
    adapter = custom.create(
        kind="exampledb",
        config={"label": "demo"},
        credentials=None,
    )
    assert isinstance(adapter, FakeAdapter)


def test_adapter_registry_rejects_duplicate_registration() -> None:
    custom = DataSourceAdapterRegistry()
    registration = AdapterRegistration(
        FakeConfig,
        False,
        lambda _config, _credentials, _path: FakeAdapter(),
    )
    custom.register("exampledb", registration)
    with pytest.raises(ValueError):
        custom.register("exampledb", registration)


def test_adapter_registry_validates_configs_and_unknown_kinds() -> None:
    parsed = registry.validate_config(
        "postgres",
        {
            "host": "localhost",
            "port": 5432,
            "database": "app",
            "schema_name": "public",
            "ssl_mode": "prefer",
        },
    )
    assert parsed.model_dump()["database"] == "app"

    with pytest.raises(DataSourceConfigurationError):
        registry.validate_config("postgres", {"host": "localhost"})
    with pytest.raises(DataSourceConfigurationError):
        registry.validate_config("oracle", {})


def test_duckdb_requires_server_resolved_database_path() -> None:
    with pytest.raises(DataSourceConfigurationError):
        registry.create(kind="duckdb", config={}, credentials=None, database_path=None)

    adapter = registry.create(
        kind="duckdb",
        config={},
        credentials=None,
        database_path=Path("/tmp/example.duckdb"),
    )
    assert adapter.__class__.__name__ == "DuckDBAdapter"
