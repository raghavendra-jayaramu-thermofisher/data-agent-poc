from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

JobHandler = Callable[[uuid.UUID], Awaitable[dict[str, object] | None]]


@dataclass(slots=True)
class JobHandlerRegistry:
    _handlers: dict[str, JobHandler]

    def __init__(self) -> None:
        self._handlers = {}

    def register(self, job_type: str, handler: JobHandler) -> None:
        if job_type in self._handlers:
            raise ValueError(f"Handler already registered for job type {job_type!r}")
        self._handlers[job_type] = handler

    def get(self, job_type: str) -> JobHandler | None:
        return self._handlers.get(job_type)


registry = JobHandlerRegistry()
