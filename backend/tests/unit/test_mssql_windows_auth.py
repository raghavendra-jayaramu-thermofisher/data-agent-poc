from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest
from pydantic import ValidationError

from app.core.errors import AppError
from app.data_sources.adapters.mssql import MSSQLAdapter
from app.data_sources.adapters.registry import registry
from app.data_sources.errors import DataSourceConfigurationError, DataSourceOperationError
from app.data_sources.schemas import (
    DataSourceUpdate,
    MSSQLConfig,
    MSSQLDataSourceCreate,
)
from app.data_sources.service import DataSourceService

CONFIG = {"host": "localhost", "database": "sales"}
CREDENTIALS = {"username": "reader", "password": "test-secret"}


def test_legacy_sql_authentication_still_requires_credentials() -> None:
    source = MSSQLDataSourceCreate(
        kind="mssql", name="Sales", config=CONFIG, credentials=CREDENTIALS
    )
    assert source.config.authentication_mode == "sql"
    with pytest.raises(ValidationError, match="SQL authentication requires"):
        MSSQLDataSourceCreate(kind="mssql", name="Sales", config=CONFIG)


def test_windows_create_accepts_no_credentials_and_rejects_supplied_credentials() -> None:
    config = {**CONFIG, "authentication_mode": "windows"}
    source = MSSQLDataSourceCreate(kind="mssql", name="Sales", config=config)
    assert source.credentials is None
    with pytest.raises(ValidationError, match="omit credentials"):
        MSSQLDataSourceCreate(kind="mssql", name="Sales", config=config, credentials=CREDENTIALS)


def odbc_string(adapter: MSSQLAdapter) -> str:
    engine = adapter._create_engine()
    return engine.dialect.create_connect_args(adapter.url)[1]["dsn"]


def test_windows_odbc_uses_trusted_connection_without_uid_or_password() -> None:
    with patch("app.data_sources.adapters.mssql.sys.platform", "win32"):
        adapter = registry.create(
            kind="mssql", config={**CONFIG, "authentication_mode": "windows"}, credentials=None
        )
    assert isinstance(adapter, MSSQLAdapter)
    connection = odbc_string(adapter)
    assert connection.count("Trusted_Connection=Yes") == 1
    assert "UID=" not in connection and "PWD=" not in connection
    assert "Encrypt=yes" in connection and "TrustServerCertificate=no" in connection


def test_sql_authentication_still_works_in_linux_deployment() -> None:
    with patch("app.data_sources.adapters.mssql.sys.platform", "linux"):
        adapter = registry.create(kind="mssql", config=CONFIG, credentials=CREDENTIALS)
    assert isinstance(adapter, MSSQLAdapter)
    connection = odbc_string(adapter)
    assert "UID=reader" in connection and "PWD=test-secret" in connection
    assert "Trusted_Connection" not in connection


def test_windows_authentication_in_linux_has_actionable_error() -> None:
    with patch("app.data_sources.adapters.mssql.sys.platform", "linux"):
        with pytest.raises(DataSourceConfigurationError) as caught:
            registry.create(
                kind="mssql", config={**CONFIG, "authentication_mode": "windows"}, credentials=None
            )
    assert caught.value.code == "MSSQL_WINDOWS_AUTH_UNSUPPORTED"
    assert "API and worker" in caught.value.public_message


def test_registry_does_not_allow_credentials_for_windows_authentication() -> None:
    with pytest.raises(DataSourceConfigurationError) as caught:
        registry.create(
            kind="mssql",
            config={**CONFIG, "authentication_mode": "windows"},
            credentials=CREDENTIALS,
        )
    assert caught.value.code == "DATASOURCE_CREDENTIALS_NOT_APPLICABLE"


@pytest.mark.asyncio
async def test_windows_login_failure_mentions_process_account() -> None:
    with patch("app.data_sources.adapters.mssql.sys.platform", "win32"):
        adapter = MSSQLAdapter(MSSQLConfig(**CONFIG, authentication_mode="windows"))
    error = DataSourceOperationError(
        "DATASOURCE_AUTHENTICATION_FAILED",
        "Login failed.",
        diagnostics={"category": "authentication", "next_steps": ["Check password."]},
    )
    with patch(
        "app.data_sources.adapters.relational.SQLAlchemyAsyncAdapter._with_engine",
        AsyncMock(side_effect=error),
    ):
        with pytest.raises(DataSourceOperationError) as caught:
            await adapter.test_connection()
    assert "Windows account" in " ".join(caught.value.diagnostics["next_steps"])
    assert "password" not in " ".join(caught.value.diagnostics["next_steps"])


@pytest.fixture
def service() -> DataSourceService:
    service = DataSourceService.__new__(DataSourceService)
    service.session = AsyncMock()
    service.repo = Mock()
    service.repo.find_by_name = AsyncMock(return_value=None)
    service.secrets = AsyncMock()
    service.adapters = registry
    return service


@pytest.mark.asyncio
async def test_create_windows_source_does_not_store_a_secret(service: DataSourceService) -> None:
    source = await service.create_relational(
        organization_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        payload=MSSQLDataSourceCreate(
            kind="mssql", name="Sales", config={**CONFIG, "authentication_mode": "windows"}
        ),
    )
    assert source.secret_id is None
    service.secrets.create.assert_not_awaited()
    service.session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_sql_source_keeps_encrypted_credentials(service: DataSourceService) -> None:
    secret = SimpleNamespace(id=uuid.uuid4())
    service.secrets.create.return_value = secret
    source = await service.create_relational(
        organization_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        payload=MSSQLDataSourceCreate(
            kind="mssql", name="Sales", config=CONFIG, credentials=CREDENTIALS
        ),
    )
    assert source.secret_id == secret.id
    service.secrets.create.assert_awaited_once()


@pytest.mark.asyncio
async def test_resolving_windows_source_skips_even_stale_secret(service: DataSourceService) -> None:
    source = SimpleNamespace(
        kind="mssql",
        config={**CONFIG, "authentication_mode": "windows"},
        secret_id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
    )
    with patch("app.data_sources.adapters.mssql.sys.platform", "win32"):
        adapter = await service.resolve_adapter(source)
    assert isinstance(adapter, MSSQLAdapter)
    assert adapter.windows_auth
    service.secrets.read.assert_not_awaited()


@pytest.fixture
def editing(service: DataSourceService):
    source = SimpleNamespace(
        id=uuid.uuid4(),
        name="Sales",
        kind="mssql",
        config=CONFIG.copy(),
        status="active",
        secret_id=uuid.uuid4(),
        last_tested_at=object(),
        last_error_code="OLD_ERROR",
        last_connection_diagnostics={"category": "authentication"},
    )
    base = SimpleNamespace(
        id=uuid.uuid4(), status="ready", current_version_id=uuid.uuid4(), last_error_code=None
    )
    service.repo.get_for_org = AsyncMock(return_value=source)
    with patch("app.data_sources.service.KnowledgeRepository") as repo:
        repo.return_value.get_base_for_source = AsyncMock(return_value=base)
        repo.return_value.lock_base = AsyncMock(return_value=base)
        yield source, base


async def update(service: DataSourceService, source, **values):
    return await service.update(
        data_source_id=source.id, organization_id=uuid.uuid4(), payload=DataSourceUpdate(**values)
    )


@pytest.mark.asyncio
async def test_switch_to_windows_deletes_secret_and_resets_test_and_knowledge(service, editing):
    source, base = editing
    secret = SimpleNamespace(id=source.secret_id)
    service.secrets.repo.get_for_org.return_value = secret
    await update(service, source, config={**CONFIG, "authentication_mode": "windows"})
    assert source.secret_id is None
    service.secrets.repo.delete.assert_awaited_once_with(secret)
    assert source.status == "pending"
    assert source.last_tested_at is None
    assert source.last_error_code is None and source.last_connection_diagnostics is None
    assert base.current_version_id is None and base.status == "empty"


@pytest.mark.asyncio
async def test_switch_to_sql_requires_new_credentials_before_changing_source(service, editing):
    source, base = editing
    source.config = {**CONFIG, "authentication_mode": "windows"}
    source.secret_id = None
    with pytest.raises(AppError) as caught:
        await update(service, source, config={**CONFIG, "authentication_mode": "sql"})
    assert caught.value.code == "DATASOURCE_CREDENTIALS_MISSING"
    assert source.config["authentication_mode"] == "windows"
    assert source.status == "active" and base.status == "ready"
    service.session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_switch_to_sql_stores_fresh_secret_and_invalidates_knowledge(service, editing):
    source, base = editing
    source.config = {**CONFIG, "authentication_mode": "windows"}
    source.secret_id = None
    secret = SimpleNamespace(id=uuid.uuid4())
    service.secrets.create.return_value = secret
    await update(
        service, source, config={**CONFIG, "authentication_mode": "sql"}, credentials=CREDENTIALS
    )
    assert source.secret_id == secret.id
    assert source.config["authentication_mode"] == "sql"
    assert source.status == "pending" and base.status == "empty"


@pytest.mark.asyncio
async def test_mode_change_is_blocked_during_knowledge_generation(service, editing):
    source, base = editing
    base.status = "generating"
    secret_id = source.secret_id
    with pytest.raises(AppError) as caught:
        await update(service, source, config={**CONFIG, "authentication_mode": "windows"})
    assert caught.value.code == "KNOWLEDGE_GENERATION_IN_PROGRESS"
    assert source.secret_id == secret_id
    assert source.config == CONFIG
    service.secrets.repo.delete.assert_not_awaited()


@pytest.mark.asyncio
async def test_windows_edit_rejects_credentials(service, editing):
    source, _ = editing
    source.config = {**CONFIG, "authentication_mode": "windows"}
    source.secret_id = None
    with pytest.raises(AppError) as caught:
        await update(service, source, credentials=CREDENTIALS)
    assert caught.value.code == "DATASOURCE_CREDENTIALS_NOT_APPLICABLE"
    service.secrets.create.assert_not_awaited()
