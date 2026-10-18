"""Extract optional finalizer suggestions without interpreting HTML or executing XML."""

import re
from xml.etree import ElementTree


def extract_follow_up_suggestions(response: str) -> tuple[str, list[str]]:
    # A missing newline must not turn private response metadata into answer prose.
    match = re.search(r"<follow_up_suggestions\b", response, re.IGNORECASE)
    if not match:
        return response, []
    answer = response[: match.start()].rstrip()
    block = response[match.start() :].strip()
    if len(block) > 8192 or "<!" in block:
        return answer, []
    try:
        root = ElementTree.fromstring(block)
    except ElementTree.ParseError:
        return answer, []
    if root.tag != "follow_up_suggestions" or root.attrib:
        return answer, []
    suggestions: list[str] = []
    seen: set[str] = set()
    for child in root:
        if child.tag != "suggestion" or child.attrib or len(child):
            continue
        question = " ".join((child.text or "").split())
        identity = question.casefold()
        if not question or len(question) > 600 or identity in seen:
            continue
        seen.add(identity)
        suggestions.append(question)
    return answer, suggestions
