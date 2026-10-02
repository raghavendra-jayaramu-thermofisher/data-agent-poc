"""Check emitted DDL with the same naming convention used by Alembic."""

import importlib.util
from io import StringIO
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations

from app.core.database import Base


def test_html_artifact_migration_handles_legacy_names_in_both_directions() -> None:
    path = Path("migrations/versions/0008_simple_html_artifact.py")
    spec = importlib.util.spec_from_file_location("html_artifact_migration", path)
    assert spec is not None and spec.loader is not None
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    for direction, kinds in (
        ("upgrade", "'text','table','chart','html'"),
        ("downgrade", "'text','table','chart'"),
    ):
        output = StringIO()
        context = MigrationContext.configure(
            dialect_name="postgresql",
            opts={"as_sql": True, "output_buffer": output, "target_metadata": Base.metadata},
        )
        with Operations.context(context):
            getattr(migration, direction)()
        sql = output.getvalue()
        assert 'DROP CONSTRAINT IF EXISTS "ck_job_artifacts_ck_job_artifacts_valid_kind"' in sql
        assert 'DROP CONSTRAINT IF EXISTS "ck_job_artifacts_valid_kind"' in sql
        assert f"ADD CONSTRAINT ck_job_artifacts_valid_kind CHECK (kind IN ({kinds}))" in sql
        assert "ADD CONSTRAINT ck_job_artifacts_ck_job_artifacts_valid_kind" not in sql
