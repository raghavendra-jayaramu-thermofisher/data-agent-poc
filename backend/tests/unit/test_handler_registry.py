from __future__ import annotations

import uuid

import pytest

from app.jobs.handlers import JobHandlerRegistry


async def handler(job_id: uuid.UUID) -> dict[str, object]:
    return {"job_id": str(job_id)}


def test_registry_is_explicit_and_deterministic() -> None:
    registry = JobHandlerRegistry()
    registry.register("test", handler)
    assert registry.get("test") is handler
    assert registry.get("missing") is None


def test_registry_rejects_duplicate_handler() -> None:
    registry = JobHandlerRegistry()
    registry.register("test", handler)
    with pytest.raises(ValueError):
        registry.register("test", handler)
