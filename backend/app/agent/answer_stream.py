"""Batched, replayable previews of the public final answer (never the analyst handoff)."""

from __future__ import annotations

import asyncio
import re
import time
import uuid
from collections.abc import Awaitable, Callable

from app.agent.artifact_directives import ARTIFACT_DIRECTIVE_LINE_PATTERN

EventWriter = Callable[[uuid.UUID, str, dict[str, object]], Awaitable[None]]
SUGGESTIONS = "<follow_up_suggestions"


def preview_markdown(raw: str, artifact_ids: frozenset[str]) -> str:
    """Return a monotonic display prefix; retain incomplete control syntax in the buffer."""
    metadata = re.search(r"<follow_up_suggestions\b", raw, re.IGNORECASE)
    text = raw[: metadata.start()] if metadata else raw
    opening = text.rfind("<")
    if opening >= 0 and SUGGESTIONS.startswith(text[opening:].lower()):
        text = text[:opening]
    stripped = text.lstrip()
    if stripped and "```".startswith(stripped):
        return ""
    wrapper = re.match(r"\A\s*```(?:markdown|md)?[ \t]*\r?\n", text, re.IGNORECASE)
    if wrapper:
        text = text[wrapper.end() :]
    elif stripped.startswith("```") and "\n" not in stripped:
        return ""

    lines = text.splitlines(keepends=True)
    visible: list[str] = []
    for index, line in enumerate(lines):
        last = index == len(lines) - 1
        content = line.strip()
        if last and content and SUGGESTIONS.startswith(content.lower()):
            break
        if wrapper and content and (content == "```" or (last and "```".startswith(content))):
            break
        if "[[artifact:" in line or (last and content and "[[artifact:".startswith(content)):
            match = ARTIFACT_DIRECTIVE_LINE_PATTERN.fullmatch(line.rstrip("\r\n"))
            if not match or match.group("artifact_id").lower() not in artifact_ids:
                # Do not reveal partial IDs, invalid references or any subsequent metadata.
                break
        visible.append(line)
    return "".join(visible).rstrip()


class AnswerStreamPublisher:
    def __init__(
        self,
        *,
        job_id: uuid.UUID,
        stream_id: uuid.UUID,
        artifact_ids: frozenset[str],
        write: EventWriter,
    ) -> None:
        self.job_id = job_id
        self.stream_id = str(stream_id)
        self.artifact_ids = artifact_ids
        self.write = write
        self.raw = ""
        self.published = ""
        self.last_flush = time.monotonic()
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        await self.write(self.job_id, "answer.started", {"stream_id": self.stream_id})

    async def flush(self) -> None:
        async with self._lock:
            text = preview_markdown(self.raw, self.artifact_ids)
            if not text.startswith(self.published):
                # Defensive: a malformed model wrapper must never corrupt displayed deltas.
                return
            delta = text[len(self.published) :]
            if not delta:
                return
            # Offsets are UTF-16 code units, matching JavaScript string.length, including emoji.
            offset = len(self.published.encode("utf-16-le")) // 2
            await self.write(
                self.job_id,
                "answer.delta",
                {
                    "stream_id": self.stream_id,
                    "offset": offset,
                    "text": delta,
                },
            )
            self.published = text
            self.last_flush = time.monotonic()
