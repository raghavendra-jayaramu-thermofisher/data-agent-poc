"""Reasoning effort values each OpenAI reasoning model accepts, from OpenAI's model pages.

OpenAI's API has no capability endpoint, and a model rejects values it does not support, so the
composer offers only the values listed here. A model not listed gets no effort control.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ReasoningEffort = Literal["none", "minimal", "low", "medium", "high", "xhigh", "max"]
REASONING_EFFORTS: tuple[ReasoningEffort, ...] = (
    "none", "minimal", "low", "medium", "high", "xhigh", "max",
)

# Sampling options OpenAI rejects while a model is reasoning (any effort other than `none`).
SAMPLING_SETTINGS = ("temperature", "top_p", "logprobs", "top_logprobs")


@dataclass(frozen=True, slots=True)
class ReasoningSupport:
    efforts: tuple[ReasoningEffort, ...]
    # None when OpenAI does not document the default.
    default: ReasoningEffort | None


_NONE_TO_XHIGH: tuple[ReasoningEffort, ...] = ("none", "low", "medium", "high", "xhigh")
_NONE_TO_MAX: tuple[ReasoningEffort, ...] = (*_NONE_TO_XHIGH, "max")
_LOW_TO_HIGH: tuple[ReasoningEffort, ...] = ("low", "medium", "high")

# Model family -> support. A family matches its own id and ids that continue with "-",
# so "gpt-5" covers gpt-5-mini and dated snapshots but not gpt-5.1.
_FAMILIES: dict[str, ReasoningSupport] = {
    "gpt-6.1-sol": ReasoningSupport(("low", "medium", "high", "xhigh", "max"), "medium"),
    "gpt-6-astra": ReasoningSupport(("low", "medium", "high", "xhigh", "max"), None),
    "gpt-6-sol": ReasoningSupport(_NONE_TO_MAX, "medium"),
    "gpt-6-luna": ReasoningSupport(_NONE_TO_MAX, "medium"),
    "gpt-5.6": ReasoningSupport(_NONE_TO_MAX, "medium"),
    "gpt-5.5": ReasoningSupport(_NONE_TO_XHIGH, "medium"),
    "gpt-5.4": ReasoningSupport(_NONE_TO_XHIGH, "none"),
    "gpt-5.2": ReasoningSupport(_NONE_TO_XHIGH, "none"),
    "gpt-5.1": ReasoningSupport(("none", "low", "medium", "high"), "none"),
    "gpt-5": ReasoningSupport(("minimal", "low", "medium", "high"), "medium"),
    "o3": ReasoningSupport(_LOW_TO_HIGH, "medium"),
    "o4-mini": ReasoningSupport(_LOW_TO_HIGH, "medium"),
}

# Variants whose efforts differ from their family (chat models do not reason; pro and codex
# models accept other subsets). Leave them without a control rather than guess.
_UNLISTED_VARIANTS = {"chat", "pro", "codex", "search", "audio", "realtime", "preview"}


def reasoning_support(model_name: str) -> ReasoningSupport | None:
    name = model_name.strip().lower().rsplit("/", 1)[-1]
    if _UNLISTED_VARIANTS & set(name.split("-")):
        return None
    for family, support in _FAMILIES.items():
        if name == family or name.startswith(f"{family}-"):
            return support
    return None


def is_reasoning(model_name: str, effort: str | None) -> bool:
    """Whether a request with this effort (None: the model's default) makes the model reason."""
    support = reasoning_support(model_name)
    if support is None:
        return False
    return (effort or support.default) != "none"


def request_settings(
    model_name: str, settings: dict[str, object], effort: str | None,
) -> dict[str, object]:
    """Profile settings plus the question's effort, without options a reasoning call rejects."""
    result = dict(settings)
    if effort is not None:
        result["reasoning_effort"] = effort
    if is_reasoning(model_name, effort):
        for key in SAMPLING_SETTINGS:
            result.pop(key, None)
    return result
