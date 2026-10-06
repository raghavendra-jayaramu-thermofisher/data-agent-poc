from __future__ import annotations

import re
from collections import Counter

from app.agent.artifact_directives import (
    ARTIFACT_DIRECTIVE_LINE_PATTERN,
    ARTIFACT_DIRECTIVE_PATTERN,
    canonical_artifact_id,
)
from app.agent.evidence import EvidenceBundle

UUID_PATTERN = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b"
)
NUMBER_PATTERN = re.compile(r"(?<![\w])[-+]?\d[\d,]*(?:\.\d+)?%?")
RAW_HTML_PATTERN = re.compile(r"<\s*/?\s*[A-Za-z][^>]*>")
OUTER_FENCE_PATTERN = re.compile(
    r"\A\s*```(?:markdown|md)?[ \t]*\r?\n(?P<body>.*)\r?\n```\s*\Z",
    re.IGNORECASE | re.DOTALL,
)


def normalize_final_answer(markdown: str) -> str:
    """Apply deterministic presentation cleanup without changing answer content."""

    stripped = markdown.strip()
    match = OUTER_FENCE_PATTERN.fullmatch(stripped)
    if match is not None:
        return match.group("body").strip()
    return stripped


def _directive_ids(markdown: str) -> tuple[list[str], list[str]]:
    ids: list[str] = []
    errors: list[str] = []
    fence: str | None = None
    for line_number, line in enumerate(markdown.splitlines(), start=1):
        stripped = line.lstrip()
        marker = (
            "```" if stripped.startswith("```") else "~~~" if stripped.startswith("~~~") else None
        )
        if marker is not None:
            if fence is None:
                fence = marker
            elif fence == marker:
                fence = None
            continue
        occurrences = list(ARTIFACT_DIRECTIVE_PATTERN.finditer(line))
        if "[[artifact:" in line and not occurrences:
            errors.append(f"Malformed artifact directive on line {line_number}.")
            continue
        if not occurrences:
            continue
        if fence is not None:
            errors.append(
                f"Artifact directives are not allowed inside code fences (line {line_number})."
            )
            continue
        line_match = ARTIFACT_DIRECTIVE_LINE_PATTERN.fullmatch(line)
        if line_match is None or len(occurrences) != 1:
            errors.append(f"Artifact directive must be on its own line (line {line_number}).")
            continue
        raw = line_match.group("artifact_id")
        canonical = canonical_artifact_id(raw)
        if canonical is None:
            errors.append(f"Artifact directive on line {line_number} must use a canonical UUID.")
            continue
        ids.append(canonical)
    return ids, errors


def _normalized_number(raw: str) -> str:
    percent = raw.endswith("%")
    value = raw[:-1] if percent else raw
    value = value.replace(",", "")
    try:
        number = float(value)
    except ValueError:
        return raw
    normalized = str(int(number)) if number.is_integer() else format(number, ".15g")
    return normalized + ("%" if percent else "")


def _numbers(value: str, *, markdown: bool = False) -> set[str]:
    cleaned = UUID_PATTERN.sub(" ", value)
    cleaned = ARTIFACT_DIRECTIVE_PATTERN.sub(" ", cleaned)
    if markdown:
        cleaned = re.sub(r"(?m)^\s*\d+[.)]\s+", "", cleaned)
        cleaned = re.sub(r"(?m)^#{1,6}\s+", "", cleaned)
    return {_normalized_number(match.group(0)) for match in NUMBER_PATTERN.finditer(cleaned)}


def grounded_numbers(bundle: EvidenceBundle) -> set[str]:
    allowed = _numbers(bundle.question) | _numbers(bundle.analyst_notes)
    for result in bundle.sql_results:
        allowed |= _numbers(result.sql_text)
        for row in result.rows:
            allowed |= _numbers(" ".join("" if value is None else str(value) for value in row))
    for artifact in bundle.artifacts:
        allowed |= _numbers(str(artifact.payload))
    return allowed


def validate_final_answer(
    markdown: str,
    bundle: EvidenceBundle,
    *,
    has_custom_instructions: bool = False,
) -> list[str]:
    errors: list[str] = []
    directive_ids, directive_errors = _directive_ids(markdown)
    errors.extend(directive_errors)
    counts = Counter(directive_ids)
    visible_ids = {str(item.artifact_id) for item in bundle.visible_artifacts}
    all_ids = {str(item.artifact_id) for item in bundle.artifacts}
    for artifact_id, count in counts.items():
        if count > 1:
            errors.append(f"Artifact {artifact_id} is referenced more than once.")
        if artifact_id not in visible_ids:
            qualifier = "hidden" if artifact_id in all_ids else "unknown"
            errors.append(f"Artifact {artifact_id} is {qualifier} and cannot be referenced.")
    for artifact_id in sorted(visible_ids - set(directive_ids)):
        errors.append(f"Visible artifact {artifact_id} must be referenced exactly once.")

    if RAW_HTML_PATTERN.search(markdown):
        errors.append("Raw HTML is not allowed in the final Markdown.")

    allowed_numbers = grounded_numbers(bundle)
    introduced = sorted(_numbers(markdown, markdown=True) - allowed_numbers)
    if introduced:
        errors.append(
            "The response introduces business numbers absent from verified evidence: "
            + ", ".join(introduced)
            + "."
        )
    return errors
