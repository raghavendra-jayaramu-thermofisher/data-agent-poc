from __future__ import annotations

from sqlalchemy.engine import URL

from app.data_sources.adapters.relational import SQLAlchemyAsyncAdapter, postgres_connect_args
from app.data_sources.schemas import DatabaseCredentials, PostgresConfig


class PostgresAdapter(SQLAlchemyAsyncAdapter):
    def __init__(self, config: PostgresConfig, credentials: DatabaseCredentials) -> None:
        url = URL.create(
            "postgresql+asyncpg",
            username=credentials.username,
            password=credentials.password.get_secret_value(),
            host=config.host,
            port=config.port,
            database=config.database,
        )
        super().__init__(
            url,
            connect_args=postgres_connect_args(config.ssl_mode),
            schema=config.schema_name,
        )
