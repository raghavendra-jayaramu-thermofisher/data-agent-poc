from __future__ import annotations

import json
import unittest

import httpx

from app.models.client import ModelMessage, OpenAICompatibleClient


class OpenAITokenLimitTests(unittest.IsolatedAsyncioTestCase):
    async def capture_request(self, base_url: str, settings: dict[str, object]) -> dict:
        captured = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured.update(json.loads(request.content))
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": "answer"}}]},
            )

        client = OpenAICompatibleClient(
            base_url=base_url,
            api_key="test-key",
            transport=httpx.MockTransport(handler),
        )
        await client.chat_completion(
            model="gpt-6.1-sol",
            messages=[ModelMessage(role="user", content="question")],
            settings=settings,
        )
        return captured

    async def test_openai_uses_completion_limit_without_mutating_saved_settings(self):
        settings = {"max_tokens": 4096, "temperature": 0.5}
        payload = await self.capture_request("https://api.openai.com/v1/", settings)
        self.assertEqual(payload["max_completion_tokens"], 4096)
        self.assertNotIn("max_tokens", payload)
        self.assertEqual(payload["temperature"], 0.5)
        self.assertEqual(settings, {"max_tokens": 4096, "temperature": 0.5})

    async def test_explicit_completion_limit_is_preserved_and_old_key_removed(self):
        payload = await self.capture_request(
            "https://api.openai.com/v1",
            {"max_tokens": 4096, "max_completion_tokens": 8192},
        )
        self.assertEqual(payload["max_completion_tokens"], 8192)
        self.assertNotIn("max_tokens", payload)

    async def test_other_endpoints_keep_their_token_parameter(self):
        for base_url in (
            "https://provider.example/v1",
            "http://localhost:11434/v1",
            "https://api.openai.com.example/v1",
        ):
            with self.subTest(base_url=base_url):
                payload = await self.capture_request(base_url, {"max_tokens": 4096})
                self.assertEqual(payload["max_tokens"], 4096)
                self.assertNotIn("max_completion_tokens", payload)

    async def test_no_limit_is_added_when_none_is_configured(self):
        payload = await self.capture_request("https://api.openai.com/v1", {})
        self.assertNotIn("max_tokens", payload)
        self.assertNotIn("max_completion_tokens", payload)
