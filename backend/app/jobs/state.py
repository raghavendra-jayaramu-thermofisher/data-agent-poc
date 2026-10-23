from __future__ import annotations

from app.core.errors import AppError

TERMINAL_STATUSES = {"succeeded", "failed", "cancelled"}
# A paused analysis holds no worker; answering re-queues it, and it can be cancelled or expire.
WAITING_STATUS = "waiting_for_input"
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "queued": {"running", "cancelled", "failed"},
    "running": {"succeeded", "failed", "cancelled", "queued", WAITING_STATUS},
    WAITING_STATUS: {"queued", "cancelled", "failed"},
    "succeeded": set(),
    "failed": set(),
    "cancelled": set(),
}


def assert_transition(current: str, target: str) -> None:
    allowed = ALLOWED_TRANSITIONS.get(current)
    if allowed is None or target not in allowed:
        raise AppError(
            "INVALID_JOB_TRANSITION",
            f"Job cannot transition from {current!r} to {target!r}.",
            409,
        )
