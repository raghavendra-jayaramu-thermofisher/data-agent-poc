from __future__ import annotations

import hashlib
import logging
import os
import uuid
from dataclasses import dataclass
from pathlib import Path

from fastapi import UploadFile

from app.core.config import Settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class StoredUpload:
    path: Path
    size_bytes: int
    sha256: str


class LocalDataSourceStorage:
    def __init__(self, settings: Settings) -> None:
        self.root = settings.data_directory.expanduser().resolve()
        self.max_upload_bytes = settings.max_excel_upload_bytes

    def datasource_dir(self, organization_id: uuid.UUID, data_source_id: uuid.UUID) -> Path:
        return self._safe_path(
            "organizations", str(organization_id), "datasources", str(data_source_id)
        )

    def source_path(
        self, organization_id: uuid.UUID, data_source_id: uuid.UUID, file_id: uuid.UUID
    ) -> Path:
        return self.datasource_dir(organization_id, data_source_id) / f"source-{file_id}.xlsx"

    def database_paths(
        self, organization_id: uuid.UUID, data_source_id: uuid.UUID, file_id: uuid.UUID
    ) -> tuple[Path, Path]:
        directory = self.datasource_dir(organization_id, data_source_id)
        final = directory / f"database-{file_id}.duckdb"
        temp = directory / f"database-{file_id}.tmp.duckdb"
        return temp, final

    def _safe_path(self, *parts: str) -> Path:
        candidate = self.root.joinpath(*parts).resolve()
        try:
            candidate.relative_to(self.root)
        except ValueError as exc:
            raise AppError("INVALID_STORAGE_PATH", "Invalid managed file path.", 500) from exc
        return candidate

    async def save_excel_upload(
        self,
        *,
        upload: UploadFile,
        organization_id: uuid.UUID,
        data_source_id: uuid.UUID,
        file_id: uuid.UUID,
    ) -> StoredUpload:
        original = Path(upload.filename or "").name
        if not original.lower().endswith(".xlsx"):
            raise AppError("EXCEL_FILE_REQUIRED", "Upload a valid .xlsx workbook.", 400)
        path = self.source_path(organization_id, data_source_id, file_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        hasher = hashlib.sha256()
        size = 0
        try:
            with path.open("xb") as target:
                while chunk := await upload.read(1024 * 1024):
                    size += len(chunk)
                    if size > self.max_upload_bytes:
                        raise AppError(
                            "EXCEL_FILE_TOO_LARGE",
                            "The workbook exceeds the configured upload size limit.",
                            413,
                        )
                    hasher.update(chunk)
                    target.write(chunk)
                target.flush()
                os.fsync(target.fileno())
        except Exception:
            path.unlink(missing_ok=True)
            raise
        finally:
            await upload.close()
        if size == 0:
            path.unlink(missing_ok=True)
            raise AppError("EXCEL_FILE_EMPTY", "The uploaded workbook is empty.", 400)
        return StoredUpload(path=path, size_bytes=size, sha256=hasher.hexdigest())

    def to_record_path(self, path: Path) -> str:
        candidate = path.expanduser().resolve()
        try:
            return candidate.relative_to(self.root).as_posix()
        except ValueError as exc:
            raise AppError("INVALID_STORAGE_PATH", "Invalid managed file path.", 500) from exc

    def from_record_path(self, path: str) -> Path:
        return self._safe_path(*Path(path).parts)

    def remove_file(self, path: str | Path | None) -> None:
        if not path:
            return
        candidate = (
            self.from_record_path(path)
            if isinstance(path, str)
            else path.expanduser().resolve()
        )
        try:
            candidate.relative_to(self.root)
        except ValueError:
            logger.error("refusing_to_delete_unmanaged_path", extra={"path": str(candidate)})
            return
        candidate.unlink(missing_ok=True)

    def remove_datasource_directory(
        self, organization_id: uuid.UUID, data_source_id: uuid.UUID
    ) -> None:
        directory = self.datasource_dir(organization_id, data_source_id)
        if not directory.exists():
            return
        for child in directory.iterdir():
            if child.is_file():
                child.unlink(missing_ok=True)
        try:
            directory.rmdir()
        except OSError:
            logger.warning("datasource_directory_not_empty", extra={"path": str(directory)})
