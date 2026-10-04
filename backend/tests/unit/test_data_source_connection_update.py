from __future__ import annotations

import unittest
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.core.errors import AppError
from app.data_sources.adapters.registry import registry
from app.data_sources.schemas import DataSourceUpdate
from app.data_sources.service import DataSourceService


class ConnectionUpdateTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.organization_id = uuid.uuid4()
        self.source = SimpleNamespace(
            id=uuid.uuid4(), name="Sales", kind="postgres", status="active",
            config={"host": "old.example.com", "port": 5432, "database": "sales",
                    "schema_name": "public", "ssl_mode": "prefer"},
            secret_id=uuid.uuid4(), last_error_code=None, last_tested_at=datetime.now(UTC),
        )
        self.base = SimpleNamespace(id=uuid.uuid4(), status="ready",
                                    current_version_id=uuid.uuid4(), last_error_code=None)
        self.service = DataSourceService.__new__(DataSourceService)
        self.service.session = AsyncMock()
        self.service.repo = AsyncMock()
        self.service.repo.get_for_org.return_value = self.source
        self.service.repo.find_by_name.return_value = None
        self.service.secrets = AsyncMock()
        self.service.adapters = registry
        self.repo_patch = patch("app.data_sources.service.KnowledgeRepository")
        self.knowledge_repo = self.repo_patch.start().return_value
        self.addCleanup(self.repo_patch.stop)
        self.knowledge_repo.get_base_for_source = AsyncMock(return_value=self.base)
        self.knowledge_repo.lock_base = AsyncMock(return_value=self.base)

    async def update(self, payload: DataSourceUpdate) -> None:
        await self.service.update(data_source_id=self.source.id,
                                  organization_id=self.organization_id, payload=payload)

    async def test_location_change_preserves_secret_and_resets_knowledge(self) -> None:
        secret_id = self.source.secret_id
        await self.update(DataSourceUpdate(config={**self.source.config, "host": "fixed.example.com"}))
        self.assertEqual(self.source.config["host"], "fixed.example.com")
        self.assertEqual(self.source.secret_id, secret_id)
        self.assertEqual(self.source.status, "pending")
        self.assertIsNone(self.source.last_tested_at)
        self.assertIsNone(self.base.current_version_id)
        self.assertEqual(self.base.status, "empty")
        self.service.secrets.replace.assert_not_awaited()
        self.service.session.commit.assert_awaited_once()

    async def test_security_change_keeps_knowledge_but_requires_retest(self) -> None:
        version = self.base.current_version_id
        await self.update(DataSourceUpdate(config={**self.source.config, "ssl_mode": "require"}))
        self.assertEqual(self.base.current_version_id, version)
        self.assertEqual(self.source.status, "pending")
        self.assertIsNone(self.source.last_tested_at)
        self.knowledge_repo.get_base_for_source.assert_not_awaited()

    async def test_name_change_keeps_connection_and_test_status(self) -> None:
        tested = self.source.last_tested_at
        await self.update(DataSourceUpdate(name="Renamed"))
        self.assertEqual(self.source.name, "Renamed")
        self.assertEqual(self.source.status, "active")
        self.assertEqual(self.source.last_tested_at, tested)
        self.knowledge_repo.get_base_for_source.assert_not_awaited()

    async def test_location_change_during_generation_is_rejected(self) -> None:
        self.base.status = "generating"
        with self.assertRaises(AppError):
            await self.update(DataSourceUpdate(config={**self.source.config, "database": "other"}))
        self.assertEqual(self.source.config["database"], "sales")
        self.service.session.commit.assert_not_awaited()

    async def test_invalid_port_is_rejected(self) -> None:
        with self.assertRaises(AppError):
            await self.update(DataSourceUpdate(config={**self.source.config, "port": 70000}))
        self.service.session.commit.assert_not_awaited()
