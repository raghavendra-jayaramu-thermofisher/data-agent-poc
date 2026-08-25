from __future__ import annotations

from sqlalchemy.engine import URL

from app.data_sources.adapters.relational import SQLAlchemyAsyncAdapter
from app.data_sources.schemas import DatabaseCredentials, MSSQLConfig


class MSSQLAdapter(SQLAlchemyAsyncAdapter):
    def __init__(self, config: MSSQLConfig, credentials: DatabaseCredentials) -> None:
        query = {
            "driver": config.odbc_driver,
            "Encrypt": "yes" if config.encrypt else "no",
            "TrustServerCertificate": "yes" if config.trust_server_certificate else "no",
        }
        url = URL.create(
            "mssql+aioodbc",
            username=credentials.username,
            password=credentials.password.get_secret_value(),
            host=config.host,
            port=config.port,
            database=config.database,
            query=query,
        )
        super().__init__(url, schema=config.schema_name)
