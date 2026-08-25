from __future__ import annotations

import ssl

from sqlalchemy.engine import URL

from app.data_sources.adapters.relational import SQLAlchemyAsyncAdapter
from app.data_sources.schemas import DatabaseCredentials, MySQLConfig


class MySQLAdapter(SQLAlchemyAsyncAdapter):
    def __init__(self, config: MySQLConfig, credentials: DatabaseCredentials) -> None:
        url = URL.create(
            "mysql+asyncmy",
            username=credentials.username,
            password=credentials.password.get_secret_value(),
            host=config.host,
            port=config.port,
            database=config.database,
        )
        connect_args: dict[str, object] = {}
        if config.ssl:
            connect_args["ssl"] = ssl.create_default_context()
        super().__init__(url, connect_args=connect_args, schema=config.database)
