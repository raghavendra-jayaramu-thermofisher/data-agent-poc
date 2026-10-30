import io
import uuid
import zipfile

import pytest

from app.knowledge.markdown_io import NoteFileError, export_zip, parse_note
from app.knowledge.models import KnowledgeAnnotation


def note(scope_type: str, scope_key: str | None, title: str | None, content: str) -> KnowledgeAnnotation:
    return KnowledgeAnnotation(
        id=uuid.uuid4(),
        knowledge_base_id=uuid.uuid4(),
        scope_type=scope_type,
        scope_key=scope_key,
        title=title,
        content=content,
        created_by=uuid.uuid4(),
    )


def test_parse_reads_scope_key_title_and_body() -> None:
    raw = b"---\ntitle: Backlog \xe2\x80\x94 Rules\nscope: Table\nkey: dbo.WoWBacklogRawData\ncategory: x\n---\n\n## Body\n\ntext\n"
    payload = parse_note("rules.md", raw).payload
    assert (payload.scope_type, payload.scope_key, payload.title) == (
        "table",
        "dbo.WoWBacklogRawData",
        "Backlog — Rules",
    )
    assert payload.content == "## Body\n\ntext"


def test_parse_accepts_bom_crlf_and_quoted_title() -> None:
    raw = b'\xef\xbb\xbf---\r\ntitle: "A: B"\r\nscope: datasource\r\n---\r\nbody\r\n'
    payload = parse_note("a.md", raw).payload
    assert payload.title == "A: B"
    assert payload.scope_key is None
    assert payload.content == "body"


def test_parse_title_falls_back_to_first_heading_then_filename() -> None:
    assert parse_note("a.md", b"---\nscope: datasource\n---\n# Fiscal calendar\nx").payload.title == (
        "Fiscal calendar"
    )
    assert parse_note("a-b.md", b"---\nscope: datasource\n---\nplain").payload.title == "a-b"


@pytest.mark.parametrize(
    ("filename", "raw", "message"),
    [
        ("a.txt", b"---\nscope: datasource\n---\nx", "Only .md"),
        ("a.md", b"no front matter", "Front matter is missing"),
        ("a.md", b"---\ntitle: x\n---\nbody", "needs scope"),
        ("a.md", b"---\nscope: [oops\n---\nbody", "not valid YAML"),
        ("a.md", b"---\njust text\n---\nbody", "name: value"),
        ("a.md", b"---\nscope: table\n---\nbody", "scope_key is required"),
        ("a.md", b"---\nscope: galaxy\n---\nbody", "scope_type"),
        ("a.md", b"---\nscope: datasource\n---\n   ", "content"),
        ("a.md", b"---\nscope: datasource\n---\n\xff\xfe", "not UTF-8"),
    ],
)
def test_parse_rejects_bad_files_with_a_readable_message(filename: str, raw: bytes, message: str) -> None:
    with pytest.raises(NoteFileError, match=message):
        parse_note(filename, raw)


def test_export_round_trips_through_parse() -> None:
    notes = [
        note("datasource", None, "Formatting: money & dates", "- Whole units only"),
        note("table", "dbo.WoWBacklogRawData", "Backlog — N1", "| a | b |\n|---|---|"),
        note("table", "dbo.WoWBacklogRawData", "Backlog — N1", "same title again"),
    ]
    with zipfile.ZipFile(io.BytesIO(export_zip(notes))) as archive:
        names = archive.namelist()
        files = {name: archive.read(name) for name in names}
    assert len(set(names)) == 3
    assert all(name.endswith(".md") for name in names)
    parsed = [parse_note(name, raw).payload for name, raw in files.items()]
    assert sorted((p.scope_type, p.scope_key, p.title, p.content) for p in parsed) == sorted(
        (n.scope_type, n.scope_key, n.title, n.content) for n in notes
    )
