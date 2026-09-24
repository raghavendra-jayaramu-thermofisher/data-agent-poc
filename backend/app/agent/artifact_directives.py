from __future__ import annotations

import re
import uuid

ARTIFACT_DIRECTIVE_PATTERN = re.compile(r"\[\[artifact:(?P<artifact_id>[0-9a-fA-F-]{36})\]\]")
ARTIFACT_DIRECTIVE_LINE_PATTERN = re.compile(
    r"^\s*\[\[artifact:(?P<artifact_id>[0-9a-fA-F-]{36})\]\]\s*$"
)


def canonical_artifact_id(raw: str) -> str | None:
    try:
        parsed = uuid.UUID(raw)
    except (ValueError, TypeError, AttributeError):
        return None
    canonical = str(parsed)
    return canonical if raw == canonical else None


def replace_artifact_directives(
    markdown: str,
    labels: dict[str, str] | None = None,
    *,
    prefix: str = "Output shown",
) -> str:
    names = labels or {}

    def replacement(match: re.Match[str]) -> str:
        artifact_id = match.group("artifact_id")
        label = names.get(artifact_id)
        if label:
            return f"[{prefix}: {label}]" if prefix else f"[{label}]"
        return f"[{prefix or 'Output shown'}]"

    return ARTIFACT_DIRECTIVE_PATTERN.sub(replacement, markdown)
