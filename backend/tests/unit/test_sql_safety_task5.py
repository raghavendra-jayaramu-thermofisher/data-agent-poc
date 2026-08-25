from __future__ import annotations

import pytest

pytest.importorskip("sqlglot", reason="Install Task 5 dependencies to run parser safety tests")

from app.agent.sql_safety import SQLSafetyViolation, validate_read_only_sql


@pytest.mark.parametrize("kind", ["postgres", "mysql", "mssql", "duckdb"])
def test_read_only_select_allowed(kind: str) -> None:
    assert validate_read_only_sql("SELECT 1", source_kind=kind) == "SELECT 1"


def test_cte_select_allowed() -> None:
    sql = "WITH totals AS (SELECT 1 AS value) SELECT value FROM totals"
    assert validate_read_only_sql(sql, source_kind="postgres") == sql


@pytest.mark.parametrize(
    "sql",
    [
        "INSERT INTO x VALUES (1)",
        "UPDATE x SET a = 1",
        "DELETE FROM x",
        "DROP TABLE x",
        "ALTER TABLE x ADD COLUMN y int",
        "CREATE TABLE x(a int)",
    ],
)
def test_writes_and_admin_sql_rejected(sql: str) -> None:
    with pytest.raises(SQLSafetyViolation):
        validate_read_only_sql(sql, source_kind="postgres")


def test_multiple_statements_rejected() -> None:
    with pytest.raises(SQLSafetyViolation) as error:
        validate_read_only_sql("SELECT 1; DROP TABLE x", source_kind="postgres")
    assert error.value.code in {"SQL_MULTIPLE_STATEMENTS", "SQL_NOT_READ_ONLY"}


def test_comment_obfuscation_does_not_turn_write_into_select() -> None:
    with pytest.raises(SQLSafetyViolation):
        validate_read_only_sql("/*safe*/ DELETE FROM x", source_kind="postgres")
