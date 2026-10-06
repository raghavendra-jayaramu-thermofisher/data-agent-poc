from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit

import httpx


def provider_diagnostics(response: httpx.Response, *, api_key: str | None, request_payload: object) -> dict[str, object]:
    sensitive = re.compile(r"(?i)authorization|cookie|api[_-]?key|password|secret|token|prompt|messages")
    secrets = [api_key] if api_key else []
    for key, value in response.request.headers.items():
        if sensitive.search(key):
            secrets.append(value)
            if value.lower().startswith("bearer "):
                secrets.append(value[7:])

    def redact_text(value: str) -> str:
        for secret in secrets:
            if secret:
                value = value.replace(secret, "[redacted]")
        if isinstance(request_payload, dict):
            for message in request_payload.get("messages", []):
                if isinstance(message, dict) and isinstance(message.get("content"), str) and message["content"]:
                    value = value.replace(message["content"], "[request content redacted]")
        value = re.sub(r"(?i)bearer\s+\S+|\bsk-[\w-]+", "[redacted]", value)
        return re.sub(r"(?i)(api[_-]?key|password|secret|token|authorization|cookie)\s*[=:]\s*[^\s,;]+", r"\1=[redacted]", value)

    def redact(value: object) -> object:
        if isinstance(value, dict):
            return {str(key): "[redacted]" if sensitive.search(str(key)) else redact(item) for key, item in value.items()}
        if isinstance(value, list):
            return [redact(item) for item in value]
        return redact_text(value) if isinstance(value, str) else value

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
    try:
        raw_body = json.dumps(redact(response.json()), ensure_ascii=True)
        body_format = "json"
    except ValueError:
        raw_body = redact_text(response.text)
        body_format = "text"
    limit = 65536
    raw = {
        "http_status": response.status_code,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "model": redact_text(str(request_payload.get("model", ""))) if isinstance(request_payload, dict) else None,
        "headers": {key: "[redacted]" if sensitive.search(key) else redact_text(value)[:4096] for key, value in list(response.headers.items())[:100]},
        "body": raw_body[:limit],
        "body_format": body_format,
        "body_truncated": len(raw_body) > limit,
        "headers_truncated": len(response.headers) > 100 or any(len(value) > 4096 for value in response.headers.values()),
    }
    url = urlsplit(str(response.request.url))
    raw.update(provider_host=url.hostname, endpoint=url.path)
    return {
        "provider_error_response": raw,
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
    fields = "\n".join(f"{key}: {value}" for key, value in diagnostics.items() if value is not None and key != "provider_error_response")
    return f"{message}\n{fields}"
