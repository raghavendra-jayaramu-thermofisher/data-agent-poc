from __future__ import annotations

import sys
from collections.abc import Callable
from typing import Any

from sqlalchemy.engine import URL
from sqlalchemy.ext.asyncio import AsyncEngine

from app.data_sources.adapters.relational import SQLAlchemyAsyncAdapter
from app.data_sources.errors import DataSourceConfigurationError, DataSourceOperationError
from app.data_sources.schemas import DatabaseCredentials, MSSQLConfig


class MSSQLAdapter(SQLAlchemyAsyncAdapter):
    def __init__(self, config: MSSQLConfig, credentials: DatabaseCredentials | None = None) -> None:
        self.windows_auth = config.authentication_mode == "windows"
        if self.windows_auth:
            if sys.platform != "win32":
                raise DataSourceConfigurationError(
                    "MSSQL_WINDOWS_AUTH_UNSUPPORTED",
                    "Windows authentication requires the API and worker to run directly "
                    "on Windows. "
                    "Use SQL authentication in this Linux Docker deployment.",
                )
            if credentials is not None:
                raise DataSourceConfigurationError(
                    "DATASOURCE_CREDENTIALS_NOT_APPLICABLE",
                    "Windows authentication uses the application Windows account; "
                    "omit credentials.",
                )
        elif credentials is None:
            raise DataSourceConfigurationError(
                "DATASOURCE_CREDENTIALS_MISSING",
                "SQL authentication requires username and password.",
            )
        query = {
            "driver": config.odbc_driver,
            "Encrypt": "yes" if config.encrypt else "no",
            "TrustServerCertificate": "yes" if config.trust_server_certificate else "no",
        }
        url = URL.create(
            "mssql+aioodbc",
            # SQLAlchemy adds Trusted_Connection=Yes when credentials are omitted.
            username=credentials.username if credentials is not None else None,
            password=credentials.password.get_secret_value() if credentials is not None else None,
            host=config.host,
            port=config.port,
            database=config.database,
            query=query,
        )
        super().__init__(url, schema=config.schema_name)

    async def _with_engine(
        self, operation: Callable[[AsyncEngine], Any], *, stage: str = "database operation"
    ) -> Any:
        try:
            return await super()._with_engine(operation, stage=stage)
        except DataSourceOperationError as error:
            if (
                self.windows_auth
                and error.diagnostics
                and error.diagnostics.get("category") in ("authentication", "database_access")
            ):
                error.diagnostics = {
                    **error.diagnostics,
                    "next_steps": [
                        "Check the Windows account running the API and worker.",
                        "Grant that Windows account access to the requested SQL Server "
                        "database and tables.",
                        "Run the API and worker under the same authorized Windows account.",
                    ],
                }
            raise
