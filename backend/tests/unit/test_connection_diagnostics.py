from __future__ import annotations

import ssl
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from sqlalchemy.engine import URL
from sqlalchemy.exc import OperationalError

from app.data_sources.adapters.relational import SQLAlchemyAsyncAdapter
from app.data_sources.diagnostics import connection_error, sanitize_driver_message
from app.data_sources.errors import DataSourceOperationError
from app.data_sources.service import DataSourceService


class DiagnosticsTests(unittest.TestCase):
    def test_classifies_driver_evidence(self) -> None:
        cases = [
            (TimeoutError(), "timeout"),
            (OSError("getaddrinfo failed"), "dns"),
            (ConnectionRefusedError("connection refused"), "refused"),
            (Exception("28000", "Login failed for user 'reader'. (18456)"), "authentication"),
            (Exception(1045, "Access denied for user"), "authentication"),
            (Exception(1049, "Unknown database"), "database_access"),
            (Exception("cannot open database (4060)"), "database_access"),
            (ssl.SSLError("certificate verify failed"), "tls"),
            (ModuleNotFoundError("No module named aioodbc"), "driver"),
            (Exception("IM002", "Data source name not found"), "driver"),
            (Exception("Unrecognized server error"), "unknown"),
        ]
        for error, category in cases:
            with self.subTest(category=category, error=error):
                result = connection_error(error, stage="connection test")
                self.assertEqual(result.diagnostics["category"], category)
                self.assertTrue(result.diagnostics["next_steps"])

    def test_unwraps_sqlalchemy_without_exposing_statement_or_credentials(self) -> None:
        original = Exception("28000", "Login failed for user 'privateuser'. PWD={secretpass}; (18456)")
        error = OperationalError("SELECT 'secret-query-value'", {}, original)
        result = connection_error(error, stage="connection test", secrets=("privateuser", "secretpass"))
        self.assertEqual(result.diagnostics["sqlstate"], "28000")
        self.assertEqual(result.diagnostics["error_number"], 18456)
        text = str(result.diagnostics)
        for secret in ("privateuser", "secretpass", "secret-query-value"):
            self.assertNotIn(secret, text)

    def test_redacts_urls_assignments_encoded_passwords_and_bounds_message(self) -> None:
        message = 'postgresql+asyncpg://u:password@host/db UID="name";PWD={sensitive}; token=hidden a%2Fb [SQL: SELECT secret]'
        result = sanitize_driver_message(message, ("a/b",))
        for secret in ("u:password", "name", "sensitive", "hidden", "a%2Fb", "SELECT secret"):
            self.assertNotIn(secret, result)
        self.assertLessEqual(len(sanitize_driver_message("x" * 5000)), 2000)


class DiagnosticsLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_adapter_preserves_sanitized_failure_and_disposes_engine(self) -> None:
        adapter = SQLAlchemyAsyncAdapter(URL.create("postgresql+asyncpg", username="reader", password="privatepassword", host="db"))
        engine = AsyncMock()
        adapter._create_engine = lambda: engine
        async def fail(_engine):
            raise ConnectionRefusedError("connection refused password=privatepassword")
        with self.assertRaises(DataSourceOperationError) as captured:
            await adapter._with_engine(fail, stage="connection test")
        self.assertEqual(captured.exception.diagnostics["category"], "refused")
        self.assertNotIn("privatepassword", str(captured.exception.diagnostics))
        engine.dispose.assert_awaited_once()

    async def test_latest_failure_is_stored_and_success_clears_it(self) -> None:
        source = SimpleNamespace(status="pending", last_error_code=None, last_connection_diagnostics=None)
        service = DataSourceService.__new__(DataSourceService)
        service.session = AsyncMock()
        diagnostics = connection_error(TimeoutError(), stage="connection test").diagnostics
        await service.mark_test_failed(source, "DATASOURCE_CONNECTION_TIMEOUT", diagnostics)
        self.assertEqual(source.last_connection_diagnostics, diagnostics)
        self.assertEqual(source.status, "error")
        await service.mark_test_succeeded(source)
        self.assertIsNone(source.last_connection_diagnostics)
        self.assertIsNone(source.last_error_code)
        self.assertEqual(source.status, "active")
