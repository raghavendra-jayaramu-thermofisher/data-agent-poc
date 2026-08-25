from __future__ import annotations

import ssl
from collections.abc import Callable
from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.engine import URL
from sqlalchemy.exc import DBAPIError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.data_sources.errors import DataSourceOperationError
from app.data_sources.types import (
    ColumnMetadata,
    ConnectionTestResult,
    ForeignKeyMetadata,
    QueryResult,
    SchemaMetadata,
    TableMetadata,
)


class SQLAlchemyAsyncAdapter:
    def __init__(
        self,
        url: URL,
        *,
        connect_args: dict[str, Any] | None = None,
        schema: str | None = None,
    ) -> None:
        self.url = url
        self.connect_args = connect_args or {}
        self.schema = schema

    def _create_engine(self) -> AsyncEngine:
        try:
            return create_async_engine(
                self.url,
                pool_pre_ping=True,
                pool_recycle=1800,
                connect_args=self.connect_args,
            )
        except (ImportError, ModuleNotFoundError) as exc:
            raise DataSourceOperationError(
                "DATASOURCE_DRIVER_UNAVAILABLE",
                "The required database driver is not installed on this server.",
            ) from exc
        except Exception as exc:
            raise DataSourceOperationError(
                "DATASOURCE_CONFIGURATION_INVALID",
                "The datasource configuration is invalid.",
            ) from exc

    async def _with_engine(self, operation: Callable[[AsyncEngine], Any]) -> Any:
        engine = self._create_engine()
        try:
            return await operation(engine)
        except DataSourceOperationError:
            raise
        except SQLAlchemyError as exc:
            raise DataSourceOperationError(
                "DATASOURCE_CONNECTION_FAILED",
                "Unable to connect to the datasource.",
                retryable=True,
            ) from exc
        except Exception as exc:
            raise DataSourceOperationError(
                "DATASOURCE_OPERATION_FAILED",
                "The datasource operation failed.",
            ) from exc
        finally:
            await engine.dispose()

    async def test_connection(self) -> ConnectionTestResult:
        async def operation(engine: AsyncEngine) -> ConnectionTestResult:
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
            return ConnectionTestResult(ok=True)

        return await self._with_engine(operation)

    async def introspect(self) -> SchemaMetadata:
        async def operation(engine: AsyncEngine) -> SchemaMetadata:
            async with engine.connect() as connection:
                return await connection.run_sync(self._inspect_sync)

        return await self._with_engine(operation)

    def _inspect_sync(self, sync_connection: Any) -> SchemaMetadata:
        inspector = inspect(sync_connection)
        tables: list[TableMetadata] = []
        names: list[tuple[str, str]] = []
        for name in inspector.get_table_names(schema=self.schema):
            names.append((name, "table"))
        try:
            for name in inspector.get_view_names(schema=self.schema):
                names.append((name, "view"))
        except NotImplementedError:
            pass

        for name, object_type in sorted(set(names), key=lambda item: (item[1], item[0])):
            columns = tuple(
                ColumnMetadata(
                    name=str(column["name"]),
                    native_type=str(column.get("type", "")),
                    nullable=column.get("nullable"),
                    default=(str(column["default"]) if column.get("default") is not None else None),
                )
                for column in inspector.get_columns(name, schema=self.schema)
            )
            primary_key: tuple[str, ...] = ()
            foreign_keys: tuple[ForeignKeyMetadata, ...] = ()
            if object_type == "table":
                try:
                    pk = inspector.get_pk_constraint(name, schema=self.schema)
                    primary_key = tuple(
                        str(value) for value in (pk.get("constrained_columns") or [])
                    )
                except NotImplementedError:
                    pass
                try:
                    foreign_keys = tuple(
                        ForeignKeyMetadata(
                            constrained_columns=tuple(
                                str(value) for value in (fk.get("constrained_columns") or [])
                            ),
                            referred_schema=(
                                str(fk["referred_schema"])
                                if fk.get("referred_schema") is not None
                                else None
                            ),
                            referred_table=str(fk.get("referred_table") or ""),
                            referred_columns=tuple(
                                str(value) for value in (fk.get("referred_columns") or [])
                            ),
                        )
                        for fk in inspector.get_foreign_keys(name, schema=self.schema)
                        if fk.get("referred_table")
                    )
                except NotImplementedError:
                    pass
            tables.append(
                TableMetadata(
                    schema=self.schema,
                    name=name,
                    object_type=object_type,
                    columns=columns,
                    primary_key=primary_key,
                    foreign_keys=foreign_keys,
                )
            )
        return SchemaMetadata(tables=tuple(tables))

    async def execute_read_query(self, sql: str, *, max_rows: int) -> QueryResult:
        async def operation(engine: AsyncEngine) -> QueryResult:
            async with engine.connect() as connection:
                try:
                    result = await connection.execute(text(sql))
                except DBAPIError as exc:
                    detail = str(exc.orig) if getattr(exc, "orig", None) is not None else str(exc)
                    raise DataSourceOperationError(
                        "DATASOURCE_QUERY_FAILED",
                        f"Query execution failed: {detail}",
                        retryable=False,
                    ) from exc
                except SQLAlchemyError as exc:
                    raise DataSourceOperationError(
                        "DATASOURCE_QUERY_FAILED",
                        f"Query execution failed: {exc}",
                        retryable=False,
                    ) from exc
                if not result.returns_rows:
                    return QueryResult(columns=(), rows=(), truncated=False)
                columns = tuple(str(value) for value in result.keys())
                fetched = result.fetchmany(max_rows + 1)
                truncated = len(fetched) > max_rows
                rows = tuple(tuple(row) for row in fetched[:max_rows])
                return QueryResult(columns=columns, rows=rows, truncated=truncated)

        return await self._with_engine(operation)


def postgres_connect_args(ssl_mode: str) -> dict[str, object]:
    if ssl_mode == "disable":
        return {"ssl": False}
    if ssl_mode == "require":
        return {"ssl": True}
    if ssl_mode in {"verify-ca", "verify-full"}:
        context = ssl.create_default_context()
        context.check_hostname = ssl_mode == "verify-full"
        context.verify_mode = ssl.CERT_REQUIRED
        return {"ssl": context}
    return {}
