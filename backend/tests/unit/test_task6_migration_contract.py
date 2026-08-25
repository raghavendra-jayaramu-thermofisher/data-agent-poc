from pathlib import Path


def test_task6_migration_contains_reporting_and_audit_schema() -> None:
    text = Path("migrations/versions/0006_task6_reporting_hardening.py").read_text()
    assert '"dashboards"' in text
    assert '"dashboard_widgets"' in text
    assert '"audit_logs"' in text
    assert "sa.DateTime(timezone=True)" in text
    assert "created_from_sql_execution_id" in text
    assert "last_refresh_job_id" in text
    assert "metric','table','bar','line','area','pie" in text
