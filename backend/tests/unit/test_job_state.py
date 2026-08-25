import pytest

from app.core.errors import AppError
from app.jobs.state import assert_transition


@pytest.mark.parametrize(
    ("current", "target"),
    [
        ("queued", "running"),
        ("queued", "cancelled"),
        ("running", "succeeded"),
        ("running", "failed"),
        ("running", "cancelled"),
        ("running", "queued"),
    ],
)
def test_valid_job_transitions(current: str, target: str) -> None:
    assert_transition(current, target)


@pytest.mark.parametrize(
    ("current", "target"),
    [
        ("succeeded", "running"),
        ("failed", "queued"),
        ("cancelled", "running"),
        ("queued", "succeeded"),
    ],
)
def test_invalid_job_transitions(current: str, target: str) -> None:
    with pytest.raises(AppError) as exc_info:
        assert_transition(current, target)
    assert exc_info.value.code == "INVALID_JOB_TRANSITION"
