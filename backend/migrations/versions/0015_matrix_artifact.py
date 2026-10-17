"""Allow immutable SQL-grounded matrix artifacts."""

from alembic import op

revision = "0015_matrix_artifact"
down_revision = "0014_conversation_table_scope"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for name in ("ck_job_artifacts_ck_job_artifacts_valid_kind", "ck_job_artifacts_valid_kind"):
        op.execute(f'ALTER TABLE job_artifacts DROP CONSTRAINT IF EXISTS "{name}"')
    op.create_check_constraint(
        op.f("ck_job_artifacts_valid_kind"),
        "job_artifacts",
        "kind IN ('text','table','chart','html','matrix')",
    )


def downgrade() -> None:
    # Preserve durable matrix artifacts. Do not destructively downgrade while any exist.
    op.execute("""DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM job_artifacts WHERE kind = 'matrix') THEN
            RAISE EXCEPTION 'Matrix artifacts exist; retain migration 0015 to preserve history';
        END IF;
    END $$""")
    op.drop_constraint(op.f("ck_job_artifacts_valid_kind"), "job_artifacts", type_="check")
    op.create_check_constraint(
        op.f("ck_job_artifacts_valid_kind"),
        "job_artifacts",
        "kind IN ('text','table','chart','html')",
    )
