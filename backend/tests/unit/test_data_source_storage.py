from __future__ import annotations

import io
import uuid
from pathlib import Path

import pytest
from fastapi import UploadFile
from openpyxl import Workbook

from app.core.config import Settings
from app.data_sources.excel import ExcelMaterializer
from app.data_sources.storage import LocalDataSourceStorage


def workbook_bytes() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Orders"
    sheet.append(["order_id", "amount"])
    sheet.append([1, 12.5])
    data = io.BytesIO()
    workbook.save(data)
    workbook.close()
    return data.getvalue()


@pytest.mark.asyncio
async def test_local_storage_uses_managed_ids_not_user_filename(tmp_path: Path) -> None:
    settings = Settings(app_env="test", data_directory=tmp_path)
    storage = LocalDataSourceStorage(settings)
    org_id = uuid.uuid4()
    data_source_id = uuid.uuid4()
    file_id = uuid.uuid4()
    upload = UploadFile(filename="../../private.xlsx", file=io.BytesIO(workbook_bytes()))

    stored = await storage.save_excel_upload(
        upload=upload,
        organization_id=org_id,
        data_source_id=data_source_id,
        file_id=file_id,
    )

    assert stored.path.name == f"source-{file_id}.xlsx"
    assert stored.path.is_file()
    assert stored.size_bytes > 0
    record_path = storage.to_record_path(stored.path)
    assert not record_path.startswith("/")
    assert storage.from_record_path(record_path) == stored.path.resolve()


@pytest.mark.asyncio
async def test_openpyxl_sheet_discovery_works_without_duckdb(tmp_path: Path) -> None:
    source = tmp_path / "book.xlsx"
    source.write_bytes(workbook_bytes())
    materializer = ExcelMaterializer(Settings(app_env="test", data_directory=tmp_path))
    assert await materializer.list_sheets(source) == ["Orders"]
