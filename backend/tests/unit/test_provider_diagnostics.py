import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx

from app.agent.final_answer import FinalAnswerRuntime, FinalAnswerError
from app.models.client import OpenAICompatibleClient, ModelMessage, ModelRuntimeConfiguration
from app.models.diagnostics import provider_diagnostics
from app.models.errors import ModelProviderError


class ProviderDiagnosticsTests(unittest.IsolatedAsyncioTestCase):
    async def test_http_rejection_retains_safe_fields_and_redacts_secrets(self):
        def handler(request):
            return httpx.Response(400, json={"error": {"message": "Unsupported temperature. Bearer privatekey privateprompt", "code": "unsupported_parameter", "type": "invalid_request_error", "param": "temperature"}, "raw_prompt": "DO NOT EXPOSE"}, headers={"x-request-id": "req-123"})
        client = OpenAICompatibleClient(base_url="https://provider.example/v1", api_key="privatekey", transport=httpx.MockTransport(handler))
        with self.assertRaises(ModelProviderError) as captured:
            await client.chat_completion(model="m", messages=[ModelMessage(role="user", content="privateprompt")])
        diagnostics = captured.exception.diagnostics
        self.assertEqual(diagnostics["http_status"], 400)
        self.assertEqual(diagnostics["parameter"], "temperature")
        self.assertEqual(diagnostics["request_id"], "req-123")
        for value in ("privatekey", "privateprompt", "DO NOT EXPOSE"):
            self.assertNotIn(value, str(diagnostics))

    async def test_non_json_body_is_saved_without_url_credentials(self):
        response = httpx.Response(502, text="private HTML and secrets", request=httpx.Request("POST", "https://user:password@host/v1/chat/completions?key=hidden"))
        result = provider_diagnostics(response, api_key=None, request_payload=None)
        self.assertEqual(result["http_status"], 502)
        self.assertEqual(result["provider_host"], "host")
        self.assertEqual(result["provider_error_response"]["body"], "private HTML and secrets")
        for secret in ("password", "hidden"):
            self.assertNotIn(secret, str(result))

    async def test_finalizer_persists_the_provider_reason_in_execution(self):
        runtime = FinalAnswerRuntime.__new__(FinalAnswerRuntime)
        runtime.settings = SimpleNamespace(
            final_answer_timeout_seconds=60, final_answer_streaming_enabled=False
        )
        client = SimpleNamespace(chat_completion=AsyncMock(side_effect=ModelProviderError("MODEL_PROVIDER_REJECTED_REQUEST", "Provider rejected request.", diagnostics={"http_status": 400, "provider_message": "Unsupported parameter", "parameter": "temperature", "provider_error_response": {"body": "extra provider detail"}})))
        runtime.client_factory = lambda *_: client
        runtime._start_execution = AsyncMock(return_value=uuid.uuid4())
        runtime._finish_execution = AsyncMock()
        async def run(_job, awaitable, **kwargs):
            return await awaitable
        with patch('app.agent.final_answer.run_cancellable', run):
            with self.assertRaises(FinalAnswerError):
                await runtime._complete(job_id=uuid.uuid4(), model=ModelRuntimeConfiguration(profile_id='p', model_name='m', base_url='https://host', api_key=None, settings={}), messages=[])
        message = runtime._finish_execution.call_args.kwargs['error_message']
        self.assertIn('http_status: 400', message)
        self.assertIn('Unsupported parameter', message)
        self.assertNotIn('extra provider detail', message)
        self.assertEqual(runtime._finish_execution.call_args.kwargs['provider_error_response'], {'body': 'extra provider detail'})

    async def test_raw_response_redacts_nested_credentials_and_retains_extra_details(self):
        response = httpx.Response(500, json={"error": {"message": "Failed", "extra": "useful detail"}, "nested": {"api_key": "private", "password": "secret"}}, headers={"set-cookie": "session=private", "x-request-id": "req-500"}, request=httpx.Request("POST", "https://host/v1/chat/completions", headers={"Authorization": "Bearer echoed-key"}))
        raw = provider_diagnostics(response, api_key=None, request_payload={"model": "m"})["provider_error_response"]
        self.assertIn("useful detail", raw["body"])
        self.assertNotIn("private", str(raw))
        self.assertEqual(raw["headers"]["set-cookie"], "[redacted]")
        self.assertEqual(raw["model"], "m")
        self.assertFalse(raw["body_truncated"])

    async def test_large_text_response_is_explicitly_truncated(self):
        response = httpx.Response(502, text="x" * 70000, request=httpx.Request("POST", "https://host/v1"))
        raw = provider_diagnostics(response, api_key=None, request_payload=None)["provider_error_response"]
        self.assertEqual(len(raw["body"]), 65536)
        self.assertTrue(raw["body_truncated"])
        self.assertEqual(raw["body_format"], "text")
