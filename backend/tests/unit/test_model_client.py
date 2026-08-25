from __future__ import annotations

import json

import httpx
import pytest

from app.models.client import ModelMessage, OpenAICompatibleClient
from app.models.errors import ModelProviderError


@pytest.mark.asyncio
async def test_list_models_and_authorization_header() -> None:
    seen: dict[str, str] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        seen["authorization"] = request.headers.get("authorization", "")
        assert str(request.url) == "https://models.example/v1/models"
        return httpx.Response(200, json={"data": [{"id": "gpt-a"}, {"id": "gpt-b"}]})

    client = OpenAICompatibleClient(
        base_url="https://models.example/v1/",
        api_key="super-secret-key",
        transport=httpx.MockTransport(handler),
    )
    assert await client.list_models() == ["gpt-a", "gpt-b"]
    assert seen["authorization"] == "Bearer super-secret-key"


@pytest.mark.asyncio
async def test_chat_completion_parses_reported_usage_without_fabricating_missing_counts() -> None:
    requests: list[dict[str, object]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(json.loads(request.content.decode("utf-8")))
        return httpx.Response(
            200,
            json={
                "model": "model-x",
                "choices": [{"message": {"role": "assistant", "content": "42"}}],
                "usage": {"prompt_tokens": 11, "completion_tokens": 2},
            },
        )

    client = OpenAICompatibleClient(
        base_url="http://localhost:8000/v1",
        api_key=None,
        transport=httpx.MockTransport(handler),
    )
    result = await client.chat_completion(
        model="model-x",
        messages=[ModelMessage(role="user", content="What is the answer?")],
        settings={"temperature": 0.1, "max_tokens": 50},
    )

    assert result.text == "42"
    assert result.model == "model-x"
    assert result.usage is not None
    assert result.usage.input_tokens == 11
    assert result.usage.output_tokens == 2
    assert result.usage.total_tokens is None
    assert requests[0]["temperature"] == 0.1


@pytest.mark.asyncio
async def test_chat_completion_returns_no_usage_when_provider_does_not_report_it() -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"role": "assistant", "content": "ok"}}]},
        )

    result = await OpenAICompatibleClient(
        base_url="http://localhost:8000/v1",
        api_key=None,
        transport=httpx.MockTransport(handler),
    ).chat_completion(
        model="local-model",
        messages=[ModelMessage(role="user", content="hello")],
    )
    assert result.usage is None


@pytest.mark.asyncio
async def test_provider_error_does_not_expose_response_body() -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(401, text="invalid api key sk-should-never-leak")

    client = OpenAICompatibleClient(
        base_url="https://models.example/v1",
        api_key="hidden",
        transport=httpx.MockTransport(handler),
    )
    with pytest.raises(ModelProviderError) as error:
        await client.list_models()
    assert error.value.code == "MODEL_PROVIDER_REJECTED_REQUEST"
    assert "sk-should-never-leak" not in error.value.public_message


@pytest.mark.asyncio
async def test_provider_timeout_is_sanitized() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("provider timed out with internal detail", request=request)

    client = OpenAICompatibleClient(
        base_url="https://models.example/v1",
        api_key="hidden",
        transport=httpx.MockTransport(handler),
    )
    with pytest.raises(ModelProviderError) as error:
        await client.list_models()
    assert error.value.code == "MODEL_PROVIDER_TIMEOUT"
    assert "internal detail" not in error.value.public_message


@pytest.mark.asyncio
async def test_malformed_provider_response_is_rejected() -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"unexpected": True})

    client = OpenAICompatibleClient(
        base_url="https://models.example/v1",
        api_key=None,
        transport=httpx.MockTransport(handler),
    )
    with pytest.raises(ModelProviderError) as error:
        await client.chat_completion(
            model="model-x",
            messages=[ModelMessage(role="user", content="hi")],
        )
    assert error.value.code == "MODEL_PROVIDER_INVALID_RESPONSE"
