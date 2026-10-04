from __future__ import annotations

import re
from urllib.parse import urlsplit

import httpx


def provider_diagnostics(response: httpx.Response, *, api_key: str | None, request_payload: object) -> dict[str, object]:
    def clean(value: object) -> str | None:
        if not isinstance(value, (str, int)):
            return None
        result = str(value)
        if api_key:
            result = result.replace(api_key, "[redacted]")
        if isinstance(request_payload, dict):
            for message in request_payload.get("messages", []):
                if isinstance(message, dict) and isinstance(message.get("content"), str) and message["content"]:
                    result = result.replace(message["content"], "[request content redacted]")
        result = re.sub(r"(?i)bearer\s+\S+|\bsk-[\w-]+", "[redacted]", result)
        result = re.sub(r"(?i)(api[_-]?key|password|token|authorization)\s*[=:]\s*[^\s,;]+", r"\1=[redacted]", result)
        return result[:2000]
    try:
        body = response.json()
    except ValueError:
        body = {}
    error = body.get("error", {}) if isinstance(body, dict) else {}
    if not isinstance(error, dict):
        error = {}
    url = urlsplit(str(response.request.url))
    return {
        "http_status": response.status_code,
        "provider_host": url.hostname,
        "endpoint": url.path,
        "request_id": clean(response.headers.get("x-request-id") or response.headers.get("request-id")),
        "provider_code": clean(error.get("code")),
        "provider_type": clean(error.get("type")),
        "parameter": clean(error.get("param")),
        "provider_message": clean(error.get("message")) or "The provider did not return a structured error message.",
    }


def diagnostic_message(message: str, diagnostics: dict[str, object] | None) -> str:
    if not diagnostics:
        return message
    fields = "\n".join(f"{key}: {value}" for key, value in diagnostics.items() if value is not None)
    return f"{message}\n{fields}"
