from __future__ import annotations

import uuid

import pytest

from app.agent.html_artifacts import HtmlArtifactStorage, HtmlArtifactValidationError


def test_html_artifact_storage_writes_one_server_owned_file_atomically(tmp_path) -> None:
    job_id = uuid.uuid4()
    artifact_id = uuid.uuid4()
    storage = HtmlArtifactStorage(tmp_path, max_bytes=4096)

    size = storage.write(
        job_id,
        artifact_id,
        "<!doctype html><html><head><style>body{color:red}</style></head>"
        "<body><h1>Revenue</h1></body></html>",
    )

    target = storage.path_for(job_id, artifact_id)
    assert target.read_text(encoding="utf-8").startswith("<!doctype html>")
    assert target.name == "index.html"
    assert size == target.stat().st_size
    assert not target.with_suffix(".tmp").exists()


@pytest.mark.parametrize(
    "html",
    [
        "```html\n<html><body>bad</body></html>\n```",
        "<body>missing html element</body>",
        "<html>missing body element</html>",
        "<html><body>missing closing html",
    ],
)
def test_html_artifact_storage_rejects_incomplete_or_fenced_documents(tmp_path, html) -> None:
    storage = HtmlArtifactStorage(tmp_path, max_bytes=4096)
    with pytest.raises(HtmlArtifactValidationError):
        storage.write(uuid.uuid4(), uuid.uuid4(), html)


def test_html_artifact_storage_enforces_utf8_byte_limit(tmp_path) -> None:
    storage = HtmlArtifactStorage(tmp_path, max_bytes=40)
    with pytest.raises(HtmlArtifactValidationError, match="40-byte"):
        storage.write(
            uuid.uuid4(),
            uuid.uuid4(),
            "<html><body>" + ("é" * 20) + "</body></html>",
        )
