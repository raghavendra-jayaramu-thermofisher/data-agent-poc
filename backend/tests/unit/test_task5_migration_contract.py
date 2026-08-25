from __future__ import annotations

from pathlib import Path


def test_task5_migration_adds_job_conversation_fk() -> None:
    text = Path("migrations/versions/0005_task5_agent.py").read_text()
    assert 'op.add_column(' in text
    assert '"jobs"' in text
    assert 'sa.Column("conversation_id"' in text
    assert 'fk_jobs_conversation_id_conversations' in text
    assert 'ix_jobs_conversation_created' in text
