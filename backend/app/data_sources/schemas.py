from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr


class DatabaseCredentials(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=255)
    password: SecretStr = Field(min_length=1, max_length=4096)


class PostgresConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    host: str = Field(min_length=1, max_length=255)
    port: int = Field(default=5432, ge=1, le=65535)
    database: str = Field(min_length=1, max_length=255)
    schema_name: str = Field(default="public", min_length=1, max_length=255)
    ssl_mode: Literal["disable", "prefer", "require", "verify-ca", "verify-full"] = "prefer"


class MySQLConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    host: str = Field(min_length=1, max_length=255)
    port: int = Field(default=3306, ge=1, le=65535)
    database: str = Field(min_length=1, max_length=255)
    ssl: bool = False


class MSSQLConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    host: str = Field(min_length=1, max_length=255)
    port: int = Field(default=1433, ge=1, le=65535)
    database: str = Field(min_length=1, max_length=255)
    schema_name: str = Field(default="dbo", min_length=1, max_length=255)
    encrypt: bool = True
    trust_server_certificate: bool = False
    odbc_driver: str = Field(default="ODBC Driver 18 for SQL Server", min_length=1, max_length=255)


class PostgresDataSourceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["postgres"]
    name: str = Field(min_length=1, max_length=180)
    config: PostgresConfig
    credentials: DatabaseCredentials


class MySQLDataSourceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["mysql"]
    name: str = Field(min_length=1, max_length=180)
    config: MySQLConfig
    credentials: DatabaseCredentials


class MSSQLDataSourceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["mssql"]
    name: str = Field(min_length=1, max_length=180)
    config: MSSQLConfig
    credentials: DatabaseCredentials


RelationalDataSourceCreate = Annotated[
    PostgresDataSourceCreate | MySQLDataSourceCreate | MSSQLDataSourceCreate,
    Field(discriminator="kind"),
]


class DataSourceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=180)
    config: dict[str, object] | None = None
    credentials: DatabaseCredentials | None = None
    status: Literal["active", "disabled"] | None = None


class DataSourceFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    original_filename: str
    size_bytes: int
    sha256: str
    status: str
    is_active: bool
    sheet_mapping: list[dict[str, object]]
    error_code: str | None
    created_at: datetime
    updated_at: datetime


class ConnectionDiagnostics(BaseModel):
    category: str
    stage: str
    message: str
    driver_message: str
    sqlstate: str | None = None
    error_number: int | None = None
    next_steps: list[str]
    job_id: str | None = None


class DataSourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    kind: str
    display_type: str
    status: str
    config: dict[str, object]
    created_by: uuid.UUID
    last_tested_at: datetime | None
    last_error_code: str | None
    last_connection_diagnostics: ConnectionDiagnostics | None = None
    created_at: datetime
    updated_at: datetime
    active_file: DataSourceFileResponse | None = None


class ColumnMetadataResponse(BaseModel):
    name: str
    native_type: str
    nullable: bool | None
    default: str | None


class ForeignKeyMetadataResponse(BaseModel):
    constrained_columns: list[str]
    referred_schema: str | None
    referred_table: str
    referred_columns: list[str]


class TableMetadataResponse(BaseModel):
    schema_name: str | None = Field(alias="schema", serialization_alias="schema")
    name: str
    object_type: str
    columns: list[ColumnMetadataResponse]
    primary_key: list[str]
    foreign_keys: list[ForeignKeyMetadataResponse]

    model_config = ConfigDict(populate_by_name=True)


class SchemaMetadataResponse(BaseModel):
    tables: list[TableMetadataResponse]


class JobAcceptedResponse(BaseModel):
    job_id: uuid.UUID


class ExcelUploadResponse(BaseModel):
    data_source: DataSourceResponse
    job_id: uuid.UUID
