from __future__ import annotations

import uuid
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.agent import evidence as evidence_module
from app.agent.evidence import (
    EvidenceSQLClassificationError,
    collect_evidence,
    is_aggregate_sql,
    validate_evidence,
)
from app.agent.models import JobArtifact, SQLExecution, ToolExecution

JOB_ID = uuid.uuid4()
SOURCE_ID = uuid.uuid4()


@pytest.mark.parametrize(
    ("source_kind", "sql", "expected"),
    [
        ("mssql", "SELECT MAX([as_of_date]) FROM [dbo].[WoWBacklogRawData]", True),
        ("mssql", "SELECT SUM([amount p$]), COUNT(*) FROM [dbo].[WoWBacklogRawData]", True),
        (
            "mssql",
            "SELECT [customer name] FROM [dbo].[WoWBacklogRawData] GROUP BY [customer name]",
            True,
        ),
        (
            "mssql",
            "WITH customers AS (SELECT [customer name], SUM([amount p$]) AS value "
            "FROM [dbo].[WoWBacklogRawData] GROUP BY [customer name]) "
            "SELECT COUNT(*), SUM(value) FROM customers",
            True,
        ),
        ("mssql", "SELECT [customer name], [amount p$] FROM [dbo].[WoWBacklogRawData]", False),
        ("postgres", 'SELECT SUM("amount p$") FROM "orders"', True),
        ("postgres", 'SELECT "customer name" FROM "orders"', False),
        ("mysql", "SELECT COUNT(*) FROM `orders`", True),
        ("mysql", "SELECT `customer name` FROM `orders`", False),
        ("duckdb", 'SELECT SUM("amount p$") FROM "orders"', True),
        ("duckdb", 'SELECT "customer name" FROM "orders"', False),
    ],
)
def test_classification_uses_native_dialect(source_kind: str, sql: str, expected: bool) -> None:
    assert is_aggregate_sql(sql, source_kind=source_kind) is expected


def test_malformed_sql_is_an_explicit_classification_failure() -> None:
    with pytest.raises(EvidenceSQLClassificationError) as caught:
        is_aggregate_sql("SELECT SUM( FROM [dbo].[orders]", source_kind="mssql")
    assert caught.value.code == "EVIDENCE_SQL_PARSE_FAILED"
    assert caught.value.dialect == "tsql"


def test_unsupported_kind_is_not_guessed_from_sql() -> None:
    with pytest.raises(EvidenceSQLClassificationError) as caught:
        is_aggregate_sql("SELECT COUNT(*) FROM orders", source_kind="unsupported")
    assert caught.value.code == "SQL_DIALECT_UNSUPPORTED"


def install_executions(monkeypatch, queries, *, source_kind="mssql"):
    tools, sql_items, artifacts = [], [], []
    for sequence, (sql, truncated) in enumerate(queries, start=1):
        tool_id, sql_id = uuid.uuid4(), uuid.uuid4()
        tools.append(
            ToolExecution(
                id=tool_id,
                job_id=JOB_ID,
                sequence=sequence,
                tool_name="execute_sql",
                status="succeeded",
                output_summary={} if source_kind is None else {"source_kind": source_kind},
            )
        )
        sql_items.append(
            SQLExecution(
                id=sql_id,
                tool_execution_id=tool_id,
                data_source_id=SOURCE_ID,
                sql_text=sql,
                status="succeeded",
                columns=["value"],
                row_count=1,
                truncated=False,
            )
        )
        artifacts.append(
            JobArtifact(
                id=uuid.uuid4(),
                job_id=JOB_ID,
                kind="table",
                name="Result",
                source_sql_execution_id=sql_id,
                payload={
                    "schema_version": 1,
                    "data_source_id": str(SOURCE_ID),
                    "columns": ["value"],
                    "rows": [[10]],
                    "row_count": 1,
                    "truncated": False,
                    "model_preview_row_count": 1,
                    "model_preview_truncated": truncated,
                    "display": "hidden",
                },
            )
        )
    repo = SimpleNamespace(
        list_tools=AsyncMock(return_value=tools),
        list_sql=AsyncMock(return_value=sql_items),
        list_artifacts=AsyncMock(return_value=artifacts),
    )
    monkeypatch.setattr(evidence_module, "AgentExecutionRepository", lambda session: repo)
    return sql_items


DETAIL = "SELECT [customer name], [amount p$] FROM [dbo].[WoWBacklogRawData]"
SUMMARY = "SELECT COUNT(*), SUM([amount p$]) FROM [dbo].[WoWBacklogRawData]"


async def load_bundle(session):
    return await collect_evidence(
        session, job_id=JOB_ID, question="Backlog summary by customer", analyst_notes=""
    )


async def test_saved_kind_reaches_classifier_and_supports_truncated_detail(monkeypatch) -> None:
    install_executions(monkeypatch, [(DETAIL, True), (SUMMARY, False)])
    session = SimpleNamespace(scalar=AsyncMock())
    bundle = await load_bundle(session)
    assert [item.is_aggregate for item in bundle.sql_results] == [False, True]
    assert validate_evidence(bundle) == []
    session.scalar.assert_not_called()
    # A truncated aggregate cannot support the partial detail preview.
    partial_summary = replace(bundle.sql_results[1], preview_truncated=True)
    partial_bundle = replace(bundle, sql_results=(bundle.sql_results[0], partial_summary))
    assert any(
        "no later complete aggregate" in issue
        for issue in validate_evidence(partial_bundle)
    )


async def test_truncated_detail_still_requires_supporting_aggregate(monkeypatch) -> None:
    install_executions(monkeypatch, [(DETAIL, True)])
    bundle = await load_bundle(SimpleNamespace(scalar=AsyncMock()))
    assert any("no later complete aggregate" in issue for issue in validate_evidence(bundle))


async def test_older_records_resolve_kind_once_per_datasource(monkeypatch) -> None:
    install_executions(monkeypatch, [(DETAIL, True), (SUMMARY, False)], source_kind=None)
    session = SimpleNamespace(scalar=AsyncMock(return_value="mssql"))
    bundle = await load_bundle(session)
    assert validate_evidence(bundle) == []
    session.scalar.assert_awaited_once()


@pytest.mark.parametrize(
    ("source_kind", "fallback_kind", "sql", "error_code"),
    [
        (None, None, SUMMARY, "EVIDENCE_SOURCE_KIND_MISSING"),
        ("unsupported", "mssql", SUMMARY, "SQL_DIALECT_UNSUPPORTED"),
        ("mssql", None, "SELECT SUM( FROM [dbo].[orders]", "EVIDENCE_SQL_PARSE_FAILED"),
    ],
)
async def test_classification_failures_block_with_execution_diagnostics(
    monkeypatch, caplog, source_kind, fallback_kind, sql, error_code
) -> None:
    items = install_executions(monkeypatch, [(sql, False)], source_kind=source_kind)
    session = SimpleNamespace(scalar=AsyncMock(return_value=fallback_kind))
    bundle = await load_bundle(session)
    issues = validate_evidence(bundle)
    assert len(issues) == 1
    assert str(items[0].id) in issues[0]
    assert error_code in issues[0]
    record = caplog.records[-1]
    assert record.sql_execution_id == str(items[0].id)
    assert record.error_code == error_code
    if error_code == "EVIDENCE_SQL_PARSE_FAILED":
        assert record.dialect == "tsql"
