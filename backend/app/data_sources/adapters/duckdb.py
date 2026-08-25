from __future__ import annotations

import asyncio
from pathlib import Path

from app.data_sources.errors import DataSourceOperationError
from app.data_sources.types import (
    ColumnMetadata,
    ConnectionTestResult,
    ForeignKeyMetadata,
    QueryResult,
    SchemaMetadata,
    TableMetadata,
)


class DuckDBAdapter:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path

    @staticmethod
    def _duckdb():  # type: ignore[no-untyped-def]
        try:
            import duckdb
        except ImportError as exc:
            raise DataSourceOperationError(
                "DATASOURCE_DRIVER_UNAVAILABLE",
                "DuckDB support is not installed on this server.",
            ) from exc
        return duckdb

    def _connect(self):  # type: ignore[no-untyped-def]
        if not self.database_path.is_file():
            raise DataSourceOperationError(
                "DATASOURCE_FILE_UNAVAILABLE",
                "The analytical database file is unavailable.",
            )
        try:
            return self._duckdb().connect(str(self.database_path), read_only=True)
        except Exception as exc:
            raise DataSourceOperationError(
                "DATASOURCE_CONNECTION_FAILED",
                "Unable to open the analytical database.",
            ) from exc

    async def test_connection(self) -> ConnectionTestResult:
        return await asyncio.to_thread(self._test_connection_sync)

    def _test_connection_sync(self) -> ConnectionTestResult:
        connection = self._connect()
        try:
            connection.execute("SELECT 1").fetchone()
            return ConnectionTestResult(ok=True)
        finally:
            connection.close()

    async def introspect(self) -> SchemaMetadata:
        return await asyncio.to_thread(self._introspect_sync)

    def _introspect_sync(self) -> SchemaMetadata:
        connection = self._connect()
        try:
            table_rows = connection.execute(
                """
                SELECT table_schema, table_name, table_type
                FROM information_schema.tables
                WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
                ORDER BY table_schema, table_name
                """
            ).fetchall()
            tables: list[TableMetadata] = []
            for schema_name, table_name, table_type in table_rows:
                column_rows = connection.execute(
                    """
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_schema = ? AND table_name = ?
                    ORDER BY ordinal_position
                    """,
                    [schema_name, table_name],
                ).fetchall()
                columns = tuple(
                    ColumnMetadata(
                        name=str(name),
                        native_type=str(native_type),
                        nullable=(str(nullable).upper() == "YES"),
                        default=(str(default) if default is not None else None),
                    )
                    for name, native_type, nullable, default in column_rows
                )
                primary_key: tuple[str, ...] = ()
                foreign_keys: tuple[ForeignKeyMetadata, ...] = ()
                try:
                    constraints = connection.execute(
                        """
                        SELECT constraint_type, constraint_column_names,
                               referenced_table, referenced_column_names
                        FROM duckdb_constraints()
                        WHERE schema_name = ? AND table_name = ?
                        ORDER BY constraint_index
                        """,
                        [schema_name, table_name],
                    ).fetchall()
                    pk_columns: list[str] = []
                    fks: list[ForeignKeyMetadata] = []
                    for constraint_type, columns_list, ref_table, ref_columns in constraints:
                        if constraint_type == "PRIMARY KEY":
                            pk_columns.extend(str(value) for value in (columns_list or []))
                        elif constraint_type == "FOREIGN KEY" and ref_table:
                            fks.append(
                                ForeignKeyMetadata(
                                    constrained_columns=tuple(
                                        str(value) for value in (columns_list or [])
                                    ),
                                    referred_schema=str(schema_name),
                                    referred_table=str(ref_table),
                                    referred_columns=tuple(
                                        str(value) for value in (ref_columns or [])
                                    ),
                                )
                            )
                    primary_key = tuple(pk_columns)
                    foreign_keys = tuple(fks)
                except Exception:
                    # Constraint introspection varies between DuckDB versions; table/column
                    # introspection remains authoritative when constraint metadata is unavailable.
                    pass
                tables.append(
                    TableMetadata(
                        schema=str(schema_name),
                        name=str(table_name),
                        object_type="view" if str(table_type).upper() == "VIEW" else "table",
                        columns=columns,
                        primary_key=primary_key,
                        foreign_keys=foreign_keys,
                    )
                )
            return SchemaMetadata(tables=tuple(tables))
        except DataSourceOperationError:
            raise
        except Exception as exc:
            raise DataSourceOperationError(
                "DATASOURCE_INTROSPECTION_FAILED",
                "Unable to inspect the analytical database.",
            ) from exc
        finally:
            connection.close()

    async def execute_read_query(self, sql: str, *, max_rows: int) -> QueryResult:
        return await asyncio.to_thread(self._execute_sync, sql, max_rows)

    def _execute_sync(self, sql: str, max_rows: int) -> QueryResult:
        connection = self._connect()
        try:
            cursor = connection.execute(sql)
            description = cursor.description or []
            columns = tuple(str(item[0]) for item in description)
            rows = cursor.fetchmany(max_rows + 1) if description else []
            return QueryResult(
                columns=columns,
                rows=tuple(tuple(row) for row in rows[:max_rows]),
                truncated=len(rows) > max_rows,
            )
        except Exception as exc:
            raise DataSourceOperationError(
                "DATASOURCE_QUERY_FAILED",
                f"Query execution failed: {exc}",
            ) from exc
        finally:
            connection.close()
