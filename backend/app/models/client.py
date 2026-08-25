from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Protocol

import httpx

from app.models.errors import ModelProviderError


@dataclass(frozen=True, slots=True)
class ModelUsage:
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None


@dataclass(frozen=True, slots=True)
class ModelMessage:
    role: Literal["system", "user", "assistant"]
    content: str


@dataclass(frozen=True, slots=True)
class ModelCompletion:
    text: str
    model: str | None
    usage: ModelUsage | None


@dataclass(frozen=True, slots=True)
class ModelRuntimeConfiguration:
    profile_id: str
    model_name: str
    base_url: str
    api_key: str | None
    settings: dict[str, object]


class ModelClient(Protocol):
    async def list_models(self) -> list[str]: ...

    async def chat_completion(
        self,
        *,
        model: str,
        messages: list[ModelMessage],
        settings: dict[str, object] | None = None,
    ) -> ModelCompletion: ...


class OpenAICompatibleClient:
    """Small, provider-agnostic OpenAI-compatible HTTP client.

    `base_url` is the API root, for example `https://api.openai.com/v1`.
    Provider response bodies are never included in public exceptions.

    """

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str | None,
        timeout_seconds: float = 30.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self.transport = transport

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout_seconds,
                transport=self.transport,
                follow_redirects=False,
            ) as client:
                response = await client.request(
                    method,
                    f"{self.base_url}/{path.lstrip('/')}",
                    headers=self._headers(),
                    **kwargs,
                )
        except httpx.TimeoutException as exc:
            raise ModelProviderError(
                "MODEL_PROVIDER_TIMEOUT",
                "The model provider did not respond in time.",
            ) from exc
        except httpx.RequestError as exc:
            raise ModelProviderError(
                "MODEL_PROVIDER_UNAVAILABLE",
                "Unable to reach the model provider.",
            ) from exc

        if response.status_code >= 400:
            raise ModelProviderError(
                "MODEL_PROVIDER_REJECTED_REQUEST",
                "The model provider rejected the request.",
            )
        return response

    async def list_models(self) -> list[str]:
        response = await self._request("GET", "models")
        try:
            payload = response.json()
            data = payload["data"]
            if not isinstance(data, list):
                raise TypeError
            models = [str(item["id"]) for item in data if isinstance(item, dict) and item.get("id")]
        except (ValueError, KeyError, TypeError) as exc:
            raise ModelProviderError(
                "MODEL_PROVIDER_INVALID_RESPONSE",
                "The model provider returned an invalid response.",
            ) from exc
        return models

    async def chat_completion(
        self,
        *,
        model: str,
        messages: list[ModelMessage],
        settings: dict[str, object] | None = None,
    ) -> ModelCompletion:
        payload: dict[str, object] = {
            "model": model,
            "messages": [{"role": item.role, "content": item.content} for item in messages],
        }
        if settings:
            for key, value in settings.items():
                if key not in {"model", "messages"}:
                    payload[key] = value

        response = await self._request("POST", "chat/completions", json=payload)
        try:
            body = response.json()
            choices = body["choices"]
            if not isinstance(choices, list) or not choices:
                raise TypeError
            first = choices[0]
            if not isinstance(first, dict):
                raise TypeError
            message = first["message"]
            if not isinstance(message, dict) or not isinstance(message.get("content"), str):
                raise TypeError
            text = message["content"]
            returned_model = body.get("model") if isinstance(body.get("model"), str) else None
            usage = self._parse_usage(body.get("usage"))
        except (ValueError, KeyError, TypeError) as exc:
            raise ModelProviderError(
                "MODEL_PROVIDER_INVALID_RESPONSE",
                "The model provider returned an invalid response.",
            ) from exc

        return ModelCompletion(text=text, model=returned_model, usage=usage)

    @staticmethod
    def _parse_usage(value: object) -> ModelUsage | None:
        if not isinstance(value, dict):
            return None

        def token(name: str) -> int | None:
            raw = value.get(name)
            return raw if isinstance(raw, int) and raw >= 0 else None

        usage = ModelUsage(
            input_tokens=token("prompt_tokens"),
            output_tokens=token("completion_tokens"),
            total_tokens=token("total_tokens"),
        )
        if usage.input_tokens is None and usage.output_tokens is None and usage.total_tokens is None:
            return None
        return usage
