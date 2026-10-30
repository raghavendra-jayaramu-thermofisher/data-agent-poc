from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass

import yaml
from pydantic import ValidationError

from app.knowledge.models import KnowledgeAnnotation
from app.knowledge.schemas import KnowledgeAnnotationCreate

MAX_IMPORT_FILES = 100
MAX_IMPORT_FILE_BYTES = 200_000
_FRONT_MATTER = re.compile(r"\A﻿?---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|\Z)", re.DOTALL)
_HEADING = re.compile(r"^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$", re.MULTILINE)


class NoteFileError(ValueError):
    """A Markdown file that cannot be turned into a knowledge note; the message is shown to the user."""


@dataclass(frozen=True)
class ParsedNote:
    filename: str
    payload: KnowledgeAnnotationCreate


def parse_note(filename: str, raw: bytes) -> ParsedNote:
    """Read one Markdown file: front matter gives scope, key and title; the rest is the note."""
    if not filename.lower().endswith(".md"):
        raise NoteFileError("Only .md files can be imported.")
    if len(raw) > MAX_IMPORT_FILE_BYTES:
        raise NoteFileError("The file is too large.")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise NoteFileError("The file is not UTF-8 text.") from error
    match = _FRONT_MATTER.match(text)
    if match is None:
        raise NoteFileError("Front matter is missing. Start the file with a --- block that sets scope.")
    try:
        meta = yaml.safe_load(match.group(1))
    except yaml.YAMLError as error:
        raise NoteFileError("The front matter is not valid YAML.") from error
    if not isinstance(meta, dict):
        raise NoteFileError("The front matter must be a list of name: value pairs.")
    body = text[match.end() :].strip()
    scope = str(meta.get("scope") or "").strip().lower()
    if not scope:
        raise NoteFileError("Front matter needs scope: datasource, table, column or metric.")
    title = meta.get("title")
    if title is None:
        heading = _HEADING.search(body)
        title = heading.group(1) if heading else filename.rsplit("/", 1)[-1][: -len(".md")]
    key = meta.get("key")
    try:
        payload = KnowledgeAnnotationCreate(
            scope_type=scope,  # type: ignore[arg-type]
            scope_key=None if key is None else str(key),
            title=str(title),
            content=body,
        )
    except ValidationError as error:
        first = error.errors()[0]
        field = ".".join(str(part) for part in first["loc"])
        raise NoteFileError(f"{field}: {first['msg']}" if field else first["msg"]) from error
    return ParsedNote(filename=filename, payload=payload)


def _slug(value: str, limit: int = 60) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", value).strip("-").lower()
    return slug[:limit].strip("-")


def render_note(item: KnowledgeAnnotation) -> str:
    meta: dict[str, str] = {}
    if item.title:
        meta["title"] = item.title
    meta["scope"] = item.scope_type
    if item.scope_key:
        meta["key"] = item.scope_key
    front = yaml.safe_dump(meta, allow_unicode=True, sort_keys=False, width=10_000).strip()
    return f"---\n{front}\n---\n\n{item.content.strip()}\n"


def export_zip(items: list[KnowledgeAnnotation]) -> bytes:
    """One .md file per note, in the same format import reads."""
    buffer = io.BytesIO()
    used: set[str] = set()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for item in items:
            stem = "-".join(
                part
                for part in (item.scope_type, _slug(item.scope_key or ""), _slug(item.title or ""))
                if part
            )
            name, number = stem, 2
            while name in used:
                name, number = f"{stem}-{number}", number + 1
            used.add(name)
            archive.writestr(f"{name}.md", render_note(item))
    return buffer.getvalue()
