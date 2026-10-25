from __future__ import annotations

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Literal, Protocol
from urllib.parse import urlsplit

import httpx

from app.models.errors import ModelProviderError
from app.models.diagnostics import provider_diagnostics
from app.models.reasoning import request_settings


@dataclass(frozen=True, slots=True)
class ModelUsage:
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    cached_input_tokens: int | None = None


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
class ModelStreamChunk:
    text: str = ""
    model: str | None = None
    usage: ModelUsage | None = None


class ModelStreamingUnsupportedError(ModelProviderError):
    """The provider explicitly rejected streaming before generating a response."""


@dataclass(frozen=True, slots=True)
class ModelRuntimeConfiguration:
    profile_id: str
    model_name: str
    base_url: str
    api_key: str | None
    settings: dict[str, object]
    # Chosen per question; None leaves the model's default.
    reasoning_effort: str | None = None

    def request_settings(self) -> dict[str, object]:
        """The generation options sent to the provider on every call of this question."""
        return request_settings(self.model_name, self.settings, self.reasoning_effort)


class ModelClient(Protocol):
    async def list_models(self) -> list[str]: ...

    async def chat_completion(
        self,
        *,
        model: str,
        messages: list[ModelMessage],
        settings: dict[str, object] | None = None,
    ) -> ModelCompletion: ...

    def stream_chat_completion(
        self,
        *,
        model: str,
        messages: list[ModelMessage],
        settings: dict[str, object] | None = None,
    ) -> AsyncIterator[ModelStreamChunk]: ...


class OpenAICompatibleClient:
    """Small, provider-agnostic OpenAI-compatible HTTP client.

    `base_url` is the API root, for example `https://api.openai.com/v1`.
    Only sanitized structured error fields are retained; response bodies and prompts are not exposed.

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
                diagnostics={"exception_type": type(exc).__name__, "timeout_seconds": self.timeout_seconds},
            ) from exc
        except httpx.RequestError as exc:
            raise ModelProviderError(
                "MODEL_PROVIDER_UNAVAILABLE",
                "Unable to reach the model provider.",
                diagnostics={"exception_type": type(exc).__name__},
            ) from exc

        if response.status_code >= 400:
            raise ModelProviderError(
                "MODEL_PROVIDER_REJECTED_REQUEST",
                "The model provider rejected the request.",
                diagnostics=provider_diagnostics(response, api_key=self.api_key, request_payload=kwargs.get("json")),
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
        payload = self._completion_payload(model, messages, settings)
        response = await self._request("POST", "chat/completions", json=payload)
        try:
            return self._parse_completion(response.json())
        except ValueError as exc:
            raise ModelProviderError(
                "MODEL_PROVIDER_INVALID_RESPONSE", "The model provider returned an invalid response.",
            ) from exc

    def _completion_payload(
        self, model: str, messages: list[ModelMessage], settings: dict[str, object] | None,
    ) -> dict[str, object]:
        payload: dict[str, object] = {
            "model": model,
            "messages": [{"role": item.role, "content": item.content} for item in messages],
        }
        if settings:
            for key, value in settings.items():
                if key not in {"model", "messages", "stream", "stream_options"}:
                    payload[key] = value

        # Saved profiles currently use max_tokens. OpenAI's newer models require
        # max_completion_tokens; keep this translation scoped to its official API.
        if urlsplit(self.base_url).hostname == "api.openai.com" and "max_tokens" in payload:
            token_limit = payload.pop("max_tokens")
            if payload.get("max_completion_tokens") is None:
                payload["max_completion_tokens"] = token_limit

        return payload

    @classmethod
    def _parse_completion(cls, body: object) -> ModelCompletion:
        try:
            if not isinstance(body, dict):
                raise TypeError
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
            usage = cls._parse_usage(body.get("usage"))
        except (ValueError, KeyError, TypeError) as exc:
            raise ModelProviderError(
                "MODEL_PROVIDER_INVALID_RESPONSE",
                "The model provider returned an invalid response.",
            ) from exc

        return ModelCompletion(text=text, model=returned_model, usage=usage)

    async def stream_chat_completion(
        self,
        *,
        model: str,
        messages: list[ModelMessage],
        settings: dict[str, object] | None = None,
    ) -> AsyncIterator[ModelStreamChunk]:
        payload = self._completion_payload(model, messages, settings)
        payload.update(stream=True, stream_options={"include_usage": True})
        # A few compatible gateways support streaming but not its optional usage flag.
        for include_usage in (True, False):
            try:
                async with httpx.AsyncClient(
                    timeout=self.timeout_seconds, transport=self.transport, follow_redirects=False,
                ) as client:
                    headers = {**self._headers(), "Accept": "text/event-stream"}
                    async with client.stream(
                        "POST", f"{self.base_url}/chat/completions", headers=headers, json=payload,
                    ) as response:
                        if response.status_code >= 400:
                            await response.aread()
                            diagnostics = provider_diagnostics(
                                response, api_key=self.api_key, request_payload=payload,
                            )
                            detail = str(diagnostics.get("provider_message", "")).lower()
                            parameter = str(diagnostics.get("parameter", "")).lower()
                            rejected_option = response.status_code in {400, 404, 422} and any(
                                word in detail for word in ("unsupported", "not support", "unknown", "unrecognized", "not allowed", "unexpected")
                            )
                            if rejected_option and include_usage and (
                                "stream_options" in detail + parameter or "include_usage" in detail + parameter
                            ):
                                payload.pop("stream_options", None)
                                continue
                            error = ModelStreamingUnsupportedError if rejected_option and (
                                parameter == "stream" or "stream" in detail
                            ) else ModelProviderError
                            raise error(
                                "MODEL_PROVIDER_REJECTED_REQUEST",
                                "The model provider rejected the request.", diagnostics=diagnostics,
                            )
                        if "application/json" in response.headers.get("content-type", ""):
                            # Some gateways ignore stream=true and return a normal completion.
                            await response.aread()
                            completion = self._parse_completion(response.json())
                            yield ModelStreamChunk(completion.text, completion.model, completion.usage)
                            return
                        frame: list[str] = []
                        finished = False
                        async for line in response.aiter_lines():
                            if line.startswith("data:"):
                                frame.append(line[5:].lstrip(" "))
                            elif line == "" and frame:
                                data = "\n".join(frame)
                                frame.clear()
                                if data.strip() == "[DONE]":
                                    return
                                chunk, terminal = self._parse_stream_frame(data)
                                finished = finished or terminal
                                yield chunk
                        if frame:
                            data = "\n".join(frame)
                            if data.strip() == "[DONE]":
                                return
                            chunk, terminal = self._parse_stream_frame(data)
                            finished = finished or terminal
                            yield chunk
                        if not finished:
                            raise ModelProviderError(
                                "MODEL_PROVIDER_STREAM_INTERRUPTED",
                                "The model provider stopped sending the answer before it finished.",
                            )
                        return
            except httpx.TimeoutException as exc:
                raise ModelProviderError(
                    "MODEL_PROVIDER_TIMEOUT", "The model provider did not respond in time.",
                ) from exc
            except httpx.RequestError as exc:
                raise ModelProviderError(
                    "MODEL_PROVIDER_UNAVAILABLE", "The connection to the model provider was interrupted.",
                ) from exc
            except (ValueError, KeyError, TypeError) as exc:
                raise ModelProviderError(
                    "MODEL_PROVIDER_INVALID_RESPONSE", "The model provider returned an invalid stream.",
                ) from exc

    @classmethod
    def _parse_stream_frame(cls, data: str) -> tuple[ModelStreamChunk, bool]:
        body = json.loads(data)
        if not isinstance(body, dict) or body.get("error"):
            raise ModelProviderError(
                "MODEL_PROVIDER_STREAM_FAILED", "The model provider could not finish the answer.",
            )
        choices = body.get("choices")
        if not isinstance(choices, list):
            raise TypeError("Missing completion choices")
        first = next((item for item in choices if isinstance(item, dict) and item.get("index", 0) == 0), {})
        delta = first.get("delta") or {}
        if not isinstance(delta, dict):
            raise TypeError("Invalid completion delta")
        text = delta.get("content")
        if text is not None and not isinstance(text, str):
            raise TypeError("Invalid completion text")
        finish_reason = first.get("finish_reason")
        if finish_reason in {"length", "content_filter", "tool_calls", "function_call"}:
            raise ModelProviderError(
                "MODEL_PROVIDER_STREAM_INCOMPLETE", "The model provider could not finish the full answer.",
            )
        return ModelStreamChunk(
            text=text or "",
            model=body.get("model") if isinstance(body.get("model"), str) else None,
            usage=cls._parse_usage(body.get("usage")),
        ), finish_reason == "stop"

    @staticmethod
    def _parse_usage(value: object) -> ModelUsage | None:
        if not isinstance(value, dict):
            return None

        def token(name: str) -> int | None:
            raw = value.get(name)
            return raw if isinstance(raw, int) and raw >= 0 else None

        details = value.get("prompt_tokens_details")
        cached = details.get("cached_tokens") if isinstance(details, dict) else None
        usage = ModelUsage(
            input_tokens=token("prompt_tokens"),
            output_tokens=token("completion_tokens"),
            total_tokens=token("total_tokens"),
            cached_input_tokens=cached if isinstance(cached, int) and cached >= 0 else None,
        )
        if usage.input_tokens is None and usage.output_tokens is None and usage.total_tokens is None:
            return None
        return usage
