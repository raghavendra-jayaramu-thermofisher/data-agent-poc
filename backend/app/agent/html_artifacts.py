from __future__ import annotations

import os
import re
import shutil
import uuid
from pathlib import Path

HTML_CONTENT_SECURITY_POLICY = (
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; "
    "img-src data:; font-src data:; media-src data:; connect-src 'none'; "
    "object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"
)


class HtmlArtifactValidationError(ValueError):
    pass


class HtmlArtifactStorage:
    """Stores one server-owned index.html per artifact under the managed data directory."""

    def __init__(self, data_directory: Path, max_bytes: int) -> None:
        self.root = data_directory.resolve() / "html-artifacts"
        self.max_bytes = max_bytes

    def path_for(self, job_id: uuid.UUID, artifact_id: uuid.UUID) -> Path:
        return self.root / job_id.hex / artifact_id.hex / "index.html"

    def write(self, job_id: uuid.UUID, artifact_id: uuid.UUID, html: str) -> int:
        content = validate_html_document(html, max_bytes=self.max_bytes)
        target = self.path_for(job_id, artifact_id)
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix(".tmp")
        try:
            temporary.write_bytes(content)
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)
        return len(content)

    def delete(self, job_id: uuid.UUID, artifact_id: uuid.UUID) -> None:
        shutil.rmtree(self.path_for(job_id, artifact_id).parent, ignore_errors=True)


def validate_html_document(html: str, *, max_bytes: int) -> bytes:
    stripped = html.strip()
    if "\x00" in stripped:
        raise HtmlArtifactValidationError("The HTML document contains an invalid null character.")
    if stripped.startswith("```") or stripped.endswith("```"):
        raise HtmlArtifactValidationError("Provide raw HTML without Markdown code fences.")
    if not re.search(r"<html(?:\s|>)", stripped, re.IGNORECASE):
        raise HtmlArtifactValidationError(
            "A complete HTML document with an <html> element is required."
        )
    if not re.search(r"<body(?:\s|>)", stripped, re.IGNORECASE):
        raise HtmlArtifactValidationError(
            "A complete HTML document with a <body> element is required."
        )
    if not re.search(r"</html\s*>", stripped, re.IGNORECASE):
        raise HtmlArtifactValidationError("The HTML document must close its <html> element.")
    content = stripped.encode("utf-8")
    if len(content) > max_bytes:
        raise HtmlArtifactValidationError(
            f"The HTML document exceeds the {max_bytes}-byte artifact limit."
        )
    return content
