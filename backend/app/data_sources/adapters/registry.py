from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, ValidationError

from app.data_sources.adapters.base import DataSourceAdapter
from app.data_sources.adapters.duckdb import DuckDBAdapter
from app.data_sources.adapters.mssql import MSSQLAdapter
from app.data_sources.adapters.mysql import MySQLAdapter
from app.data_sources.adapters.postgres import PostgresAdapter
from app.data_sources.errors import DataSourceConfigurationError
from app.data_sources.schemas import DatabaseCredentials, MSSQLConfig, MySQLConfig, PostgresConfig

AdapterFactory = Callable[[BaseModel, DatabaseCredentials | None, Path | None], DataSourceAdapter]


@dataclass(frozen=True, slots=True)
class AdapterRegistration:
    config_model: type[BaseModel]
    requires_credentials: bool
    factory: AdapterFactory


class DataSourceAdapterRegistry:
    def __init__(self) -> None:
        self._registrations: dict[str, AdapterRegistration] = {}

    def register(self, kind: str, registration: AdapterRegistration) -> None:
        if kind in self._registrations:
            raise ValueError(f"Datasource adapter already registered for {kind!r}")
        self._registrations[kind] = registration

    def supported_kinds(self) -> tuple[str, ...]:
        return tuple(sorted(self._registrations))

    def validate_config(self, kind: str, config: dict[str, object]) -> BaseModel:
        registration = self._registrations.get(kind)
        if registration is None:
            raise DataSourceConfigurationError(
                "DATASOURCE_KIND_UNSUPPORTED", "This datasource type is not supported."
            )
        try:
            return registration.config_model.model_validate(config)
        except ValidationError as exc:
            raise DataSourceConfigurationError(
                "DATASOURCE_CONFIG_INVALID", "The datasource configuration is invalid."
            ) from exc

    def create(
        self,
        *,
        kind: str,
        config: dict[str, object],
        credentials: dict[str, Any] | None,
        database_path: Path | None = None,
    ) -> DataSourceAdapter:
        registration = self._registrations.get(kind)
        if registration is None:
            raise DataSourceConfigurationError(
                "DATASOURCE_KIND_UNSUPPORTED", "This datasource type is not supported."
            )
        parsed_config = self.validate_config(kind, config)
        parsed_credentials: DatabaseCredentials | None = None
        if registration.requires_credentials:
            if credentials is None:
                raise DataSourceConfigurationError(
                    "DATASOURCE_CREDENTIALS_MISSING", "Datasource credentials are unavailable."
                )
            try:
                parsed_credentials = DatabaseCredentials.model_validate(credentials)
            except ValidationError as exc:
                raise DataSourceConfigurationError(
                    "DATASOURCE_CREDENTIALS_INVALID", "Datasource credentials are invalid."
                ) from exc
        return registration.factory(parsed_config, parsed_credentials, database_path)


class DuckDBConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _require_credentials(credentials: DatabaseCredentials | None) -> DatabaseCredentials:
    if credentials is None:
        raise DataSourceConfigurationError(
            "DATASOURCE_CREDENTIALS_MISSING", "Datasource credentials are unavailable."
        )
    return credentials


def _postgres_factory(
    config: BaseModel, credentials: DatabaseCredentials | None, _path: Path | None
) -> DataSourceAdapter:
    assert isinstance(config, PostgresConfig)
    return PostgresAdapter(config, _require_credentials(credentials))


def _mysql_factory(
    config: BaseModel, credentials: DatabaseCredentials | None, _path: Path | None
) -> DataSourceAdapter:
    assert isinstance(config, MySQLConfig)
    return MySQLAdapter(config, _require_credentials(credentials))


def _mssql_factory(
    config: BaseModel, credentials: DatabaseCredentials | None, _path: Path | None
) -> DataSourceAdapter:
    assert isinstance(config, MSSQLConfig)
    return MSSQLAdapter(config, _require_credentials(credentials))


def _duckdb_factory(
    _config: BaseModel, _credentials: DatabaseCredentials | None, path: Path | None
) -> DataSourceAdapter:
    if path is None:
        raise DataSourceConfigurationError(
            "DATASOURCE_FILE_UNAVAILABLE", "The analytical database file is unavailable."
        )
    return DuckDBAdapter(path)


registry = DataSourceAdapterRegistry()
registry.register("postgres", AdapterRegistration(PostgresConfig, True, _postgres_factory))
registry.register("mysql", AdapterRegistration(MySQLConfig, True, _mysql_factory))
registry.register("mssql", AdapterRegistration(MSSQLConfig, True, _mssql_factory))
registry.register("duckdb", AdapterRegistration(DuckDBConfig, False, _duckdb_factory))
