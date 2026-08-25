from __future__ import annotations

import uuid
from datetime import UTC, datetime

from app.data_sources.models import DataSource
from app.data_sources.schemas import DataSourceResponse


def test_data_source_response_never_exposes_secret_id_or_storage_paths() -> None:
    now = datetime.now(UTC)
    data_source = DataSource(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        name="Production",
        kind="postgres",
        display_type="postgres",
        status="active",
        config={"host": "db.example", "database": "sales"},
        secret_id=uuid.uuid4(),
        created_by=uuid.uuid4(),
        last_tested_at=now,
        last_error_code=None,
        created_at=now,
        updated_at=now,
    )
    payload = DataSourceResponse.model_validate(data_source).model_dump(mode="json")
    assert "secret_id" not in payload
    assert "source_path" not in payload
    assert payload["config"] == {"host": "db.example", "database": "sales"}
