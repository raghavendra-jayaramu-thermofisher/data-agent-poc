from __future__ import annotations

import re
from collections import Counter
from difflib import SequenceMatcher

from app.agent.artifact_directives import (
    ARTIFACT_DIRECTIVE_LINE_PATTERN,
    ARTIFACT_DIRECTIVE_PATTERN,
    canonical_artifact_id,
)
from app.agent.evidence import EvidenceBundle

HEADING_PATTERN = re.compile(r"(?m)^###\s+(.+?)\s*$")
UUID_PATTERN = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b"
)
NUMBER_PATTERN = re.compile(r"(?<![\w])[-+]?\d[\d,]*(?:\.\d+)?%?")
RAW_HTML_PATTERN = re.compile(r"<\s*/?\s*[A-Za-z][^>]*>")


def _section(markdown: str, heading: str) -> str:
    matches = list(HEADING_PATTERN.finditer(markdown))
    for index, match in enumerate(matches):
        if match.group(1).strip() != heading:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
        return markdown[match.end() : end].strip()
    return ""


def _normalize_prose(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", value.casefold()))


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


def validate_final_answer(markdown: str, bundle: EvidenceBundle) -> list[str]:
    errors: list[str] = []
    stripped = markdown.strip()
    first_line = stripped.splitlines()[0].strip() if stripped else ""
    if first_line != "### Objective":
        errors.append("The first non-whitespace heading must be `### Objective`.")

    headings = [match.group(1).strip() for match in HEADING_PATTERN.finditer(markdown)]
    required = ["Objective", "What I understood", "Answer"]
    for heading in required:
        count = headings.count(heading)
        if count != 1:
            errors.append(f"Required heading `{heading}` must appear exactly once.")

    known_order = [
        heading
        for heading in headings
        if heading in {"Objective", "What I understood", "Unable to answer", "Answer"}
    ]
    expected_order = ["Objective", "What I understood"]
    if bundle.unavailable_information:
        expected_order.append("Unable to answer")
        if headings.count("Unable to answer") != 1:
            errors.append(
                "`### Unable to answer` is required because verified unavailable information "
                "exists."
            )
    elif "Unable to answer" in headings:
        errors.append(
            "`### Unable to answer` must be omitted because no unavailable information was "
            "verified."
        )
    expected_order.append("Answer")
    if known_order != expected_order:
        errors.append("Required sections are missing, duplicated, or out of order.")

    objective = _section(markdown, "Objective")
    understood = _section(markdown, "What I understood")
    answer = _section(markdown, "Answer")
    if not objective:
        errors.append("Objective content is empty.")
    else:
        normalized_objective = _normalize_prose(objective)
        normalized_question = _normalize_prose(bundle.question)
        similarity = SequenceMatcher(None, normalized_objective, normalized_question).ratio()
        if normalized_objective == normalized_question or similarity >= 0.95:
            errors.append("The Objective repeats the raw question instead of stating its purpose.")
        if objective.rstrip().endswith("?"):
            errors.append("The Objective must be a purpose statement, not a question.")
    if not understood:
        errors.append("What I understood content is empty.")
    if bundle.unavailable_information and not _section(markdown, "Unable to answer"):
        errors.append("Unable to answer content is empty.")
    if not answer:
        errors.append("Answer content is empty.")

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
