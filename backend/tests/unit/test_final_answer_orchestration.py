from __future__ import annotations

import uuid

import pytest

from app.agent import final_answer as final_answer_module
from app.agent.artifact_directives import replace_artifact_directives
from app.agent.evidence import (
    ArtifactEvidence,
    EvidenceBundle,
    SQLResultEvidence,
    is_aggregate_sql,
    mark_visible_artifacts,
    render_evidence_context,
    validate_evidence,
)
from app.agent.final_answer import FinalAnswerError, FinalAnswerRuntime
from app.agent.final_answer_validation import normalize_final_answer, validate_final_answer
from app.agent.tools import AgentCancelledError
from app.core.config import Settings
from app.models.client import ModelCompletion, ModelMessage, ModelRuntimeConfiguration, ModelUsage

JOB_ID = uuid.UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
SOURCE_ID = uuid.UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
DETAIL_ID = uuid.UUID("cccccccc-cccc-4ccc-8ccc-cccccccccccc")
AGGREGATE_ID = uuid.UUID("dddddddd-dddd-4ddd-8ddd-dddddddddddd")
ARTIFACT_ID = uuid.UUID("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")


def sql_evidence(
    *,
    execution_id: uuid.UUID,
    sequence: int,
    sql: str,
    rows: tuple[tuple[object, ...], ...],
    truncated: bool,
) -> SQLResultEvidence:
    return SQLResultEvidence(
        execution_id=execution_id,
        tool_sequence=sequence,
        data_source_id=SOURCE_ID,
        sql_text=sql,
        columns=("status", "count"),
        rows=rows,
        stored_row_count=len(rows),
        preview_row_count=min(len(rows), 1),
        preview_truncated=truncated,
        stored_result_truncated=False,
        is_aggregate=is_aggregate_sql(sql, source_kind="postgres"),
        table_artifact_id=None,
        title="Results",
        display="hidden",
    )


def artifact(artifact_id: uuid.UUID = ARTIFACT_ID) -> ArtifactEvidence:
    return ArtifactEvidence(
        artifact_id=artifact_id,
        kind="chart",
        title="Orders by status",
        source_sql_execution_id=AGGREGATE_ID,
        payload={"schema_version": 1, "renderer": "frontend", "chart_type": "bar"},
        valid=True,
        visible=True,
    )


def bundle(*, unavailable: bool = False) -> EvidenceBundle:
    aggregate = sql_evidence(
        execution_id=AGGREGATE_ID,
        sequence=2,
        sql="SELECT status, COUNT(*) AS count FROM orders GROUP BY status",
        rows=(("Open", 12), ("Held", 3)),
        truncated=False,
    )
    return EvidenceBundle(
        job_id=JOB_ID,
        question="How many orders are open and show a chart?",
        analyst_notes="The aggregate query found 12 open orders and 3 held orders.",
        sql_results=(aggregate,),
        artifacts=(artifact(),),
        unavailable_information=unavailable,
    )


def test_sql_classifier_recognizes_aggregates() -> None:
    assert is_aggregate_sql("SELECT COUNT(*) FROM orders", source_kind="postgres")
    assert is_aggregate_sql("SELECT status FROM orders GROUP BY status", source_kind="postgres")
    assert not is_aggregate_sql("SELECT order_id, status FROM orders", source_kind="postgres")


def test_truncated_detail_requires_later_complete_aggregate() -> None:
    detail = sql_evidence(
        execution_id=DETAIL_ID,
        sequence=1,
        sql="SELECT order_id, status FROM orders",
        rows=(("SO-1", "Open"),),
        truncated=True,
    )
    without_aggregate = bundle()
    without_aggregate = EvidenceBundle(
        job_id=without_aggregate.job_id,
        question=without_aggregate.question,
        analyst_notes=without_aggregate.analyst_notes,
        sql_results=(detail,),
        artifacts=(),
        unavailable_information=False,
    )
    assert any(
        "no later complete aggregate" in issue for issue in validate_evidence(without_aggregate)
    )

    with_aggregate = bundle()
    with_aggregate = EvidenceBundle(
        job_id=with_aggregate.job_id,
        question=with_aggregate.question,
        analyst_notes=with_aggregate.analyst_notes,
        sql_results=(detail, *with_aggregate.sql_results),
        artifacts=with_aggregate.artifacts,
        unavailable_information=False,
    )
    assert validate_evidence(with_aggregate) == []


def test_duplicate_chart_artifacts_are_rendered_once() -> None:
    duplicate_id = uuid.UUID("ffffffff-ffff-4fff-8fff-ffffffffffff")
    marked = mark_visible_artifacts([artifact(), artifact(duplicate_id)])

    assert marked[0].visible
    assert not marked[1].visible


def test_duplicate_table_artifacts_are_rendered_once_even_with_different_sql_ids() -> None:
    payload = {
        "schema_version": 1,
        "columns": ["order_number"],
        "rows": [],
        "row_count": 0,
        "display": "expanded",
    }
    first = ArtifactEvidence(
        artifact_id=uuid.uuid4(),
        kind="table",
        title="Orders requiring action",
        source_sql_execution_id=uuid.uuid4(),
        payload=payload,
        valid=True,
    )
    second = ArtifactEvidence(
        artifact_id=uuid.uuid4(),
        kind="table",
        title="Orders requiring action",
        source_sql_execution_id=uuid.uuid4(),
        payload=payload,
        valid=True,
    )

    marked = mark_visible_artifacts([first, second])

    assert marked[0].visible
    assert not marked[1].visible


def test_large_hidden_table_is_available_when_no_other_output_can_show_the_detail() -> None:
    hidden_table = ArtifactEvidence(
        artifact_id=uuid.uuid4(),
        kind="table",
        title="Detailed orders",
        source_sql_execution_id=DETAIL_ID,
        payload={"display": "hidden", "row_count": 407},
        valid=True,
    )

    marked = mark_visible_artifacts([hidden_table])

    assert marked[0].visible


def test_finalizer_context_exposes_only_copy_ready_artifact_directives() -> None:
    evidence = bundle()
    context = render_evidence_context(evidence)

    assert f"ARTIFACT DIRECTIVE: [[artifact:{ARTIFACT_ID}]]" in context
    assert str(AGGREGATE_ID) not in context
    assert str(SOURCE_ID) not in context


def test_final_answer_contract_accepts_grounded_markdown_and_artifact() -> None:
    markdown = f"""There are **12 open orders** and **3 held orders**.

[[artifact:{ARTIFACT_ID}]]
"""
    assert validate_final_answer(markdown, bundle()) == []


def test_final_answer_contract_rejects_unverified_number_and_unknown_artifact() -> None:
    unknown_id = uuid.UUID("ffffffff-ffff-4fff-8fff-ffffffffffff")
    markdown = f"""There are 99 open orders.

[[artifact:{unknown_id}]]
"""
    errors = validate_final_answer(markdown, bundle())
    assert any("unknown" in error for error in errors)
    assert any("99" in error for error in errors)


def test_final_answer_contract_rejects_duplicate_artifact() -> None:
    markdown = f"""There are 12 open orders and 3 held orders.

[[artifact:{ARTIFACT_ID}]]

[[artifact:{ARTIFACT_ID}]]
"""
    assert any("more than once" in error for error in validate_final_answer(markdown, bundle()))


def test_normalizer_unwraps_an_outer_markdown_fence() -> None:
    markdown = "```markdown\nThe result is available.\n```"
    assert normalize_final_answer(markdown) == "The result is available."


def test_history_directives_become_descriptive_labels() -> None:
    markdown = f"Before\n\n[[artifact:{ARTIFACT_ID}]]\n\nAfter"
    normalized = replace_artifact_directives(
        markdown,
        {str(ARTIFACT_ID): "Chart shown: Orders by status"},
        prefix="",
    )
    assert "[[artifact:" not in normalized
    assert "[Chart shown: Orders by status]" in normalized


class FakeFinalAnswerClient:
    def __init__(self, responses: list[str]) -> None:
        self.responses = responses
        self.calls: list[list[ModelMessage]] = []

    async def list_models(self) -> list[str]:
        return ["writer"]

    async def chat_completion(
        self,
        *,
        model: str,
        messages: list[ModelMessage],
        settings: dict[str, object] | None = None,
    ) -> ModelCompletion:
        del model, settings
        self.calls.append(messages)
        return ModelCompletion(
            text=self.responses.pop(0),
            model="writer",
            usage=ModelUsage(input_tokens=10, output_tokens=20, total_tokens=30),
        )


@pytest.mark.asyncio
async def test_finalizer_returns_imperfect_markdown_with_quality_warning(monkeypatch) -> None:
    unknown_id = "ffffffff-ffff-4fff-8fff-ffffffffffff"
    invalid = (
        "There are 12 open orders.\n\n"
        f"[[artifact:{unknown_id}]]"
    )
    client = FakeFinalAnswerClient([invalid + '\n\n<follow_up_suggestions><suggestion>Compare regions?</suggestion></follow_up_suggestions>'])
    events: list[str] = []
    finishes: list[str] = []

    async def fake_event(job_id, event_type, payload, level="info"):
        del job_id, payload, level
        events.append(event_type)

    async def fake_cancellable(job_id, awaitable, timeout_seconds):
        del job_id, timeout_seconds
        return await awaitable

    async def fake_start(job_id, model):
        del job_id, model
        return uuid.uuid4()

    async def fake_finish(execution_id, *, status, **kwargs):
        del execution_id, kwargs
        finishes.append(status)

    monkeypatch.setattr(final_answer_module, "append_agent_event", fake_event)
    monkeypatch.setattr(final_answer_module, "run_cancellable", fake_cancellable)
    monkeypatch.setattr(FinalAnswerRuntime, "_start_execution", staticmethod(fake_start))
    monkeypatch.setattr(FinalAnswerRuntime, "_finish_execution", staticmethod(fake_finish))

    runtime = FinalAnswerRuntime(
        settings=Settings(),
        client_factory=lambda _model, _timeout: client,
    )
    model = ModelRuntimeConfiguration(
        profile_id="11111111-1111-4111-8111-111111111111",
        model_name="writer",
        base_url="http://model.invalid/v1",
        api_key=None,
        settings={},
    )
    suggestions: list[str] = []
    answer = await runtime.run(job_id=JOB_ID, model=model, evidence=bundle(), follow_up_suggestions=suggestions)

    # The answer keeps its content; only a title is added when the model wrote none.
    assert answer.startswith('# ') and answer.endswith(invalid)
    assert suggestions == ['Compare regions?']
    assert 'Follow-up suggestions output contract' in client.calls[0][0].content
    assert len(client.calls) == 1
    assert finishes == ["succeeded"]
    assert events == [
        "finalization.started",
        "finalization.quality_warning",
        "finalization.completed",
    ]


@pytest.mark.asyncio
async def test_finalizer_only_fails_when_the_model_returns_no_usable_answer(monkeypatch) -> None:
    client = FakeFinalAnswerClient([""])
    events: list[str] = []

    async def fake_event(job_id, event_type, payload, level="info"):
        del job_id, payload, level
        events.append(event_type)

    async def fake_cancellable(job_id, awaitable, timeout_seconds):
        del job_id, timeout_seconds
        return await awaitable

    async def fake_start(job_id, model):
        del job_id, model
        return uuid.uuid4()

    async def fake_finish(execution_id, *, status, **kwargs):
        del execution_id, status, kwargs

    monkeypatch.setattr(final_answer_module, "append_agent_event", fake_event)
    monkeypatch.setattr(final_answer_module, "run_cancellable", fake_cancellable)
    monkeypatch.setattr(FinalAnswerRuntime, "_start_execution", staticmethod(fake_start))
    monkeypatch.setattr(FinalAnswerRuntime, "_finish_execution", staticmethod(fake_finish))

    runtime = FinalAnswerRuntime(
        settings=Settings(),
        client_factory=lambda _model, _timeout: client,
    )
    model = ModelRuntimeConfiguration(
        profile_id="11111111-1111-4111-8111-111111111111",
        model_name="writer",
        base_url="http://model.invalid/v1",
        api_key=None,
        settings={},
    )

    with pytest.raises(FinalAnswerError, match="empty response") as caught:
        await runtime.run(job_id=JOB_ID, model=model, evidence=bundle())

    assert caught.value.code == "FINAL_ANSWER_INVALID"
    assert len(client.calls) == 1
    assert events == ["finalization.started"]


@pytest.mark.asyncio
async def test_finalizer_propagates_cancellation_without_repair(monkeypatch) -> None:
    client = FakeFinalAnswerClient([])
    finishes: list[tuple[str, str | None]] = []

    async def fake_event(job_id, event_type, payload, level="info"):
        del job_id, event_type, payload, level

    async def fake_cancellable(job_id, awaitable, timeout_seconds):
        del job_id, timeout_seconds
        awaitable.close()
        raise AgentCancelledError

    async def fake_start(job_id, model):
        del job_id, model
        return uuid.uuid4()

    async def fake_finish(execution_id, *, status, error_code=None, **kwargs):
        del execution_id, kwargs
        finishes.append((status, error_code))

    monkeypatch.setattr(final_answer_module, "append_agent_event", fake_event)
    monkeypatch.setattr(final_answer_module, "run_cancellable", fake_cancellable)
    monkeypatch.setattr(FinalAnswerRuntime, "_start_execution", staticmethod(fake_start))
    monkeypatch.setattr(FinalAnswerRuntime, "_finish_execution", staticmethod(fake_finish))

    runtime = FinalAnswerRuntime(
        settings=Settings(),
        client_factory=lambda _model, _timeout: client,
    )
    model = ModelRuntimeConfiguration(
        profile_id="11111111-1111-4111-8111-111111111111",
        model_name="writer",
        base_url="http://model.invalid/v1",
        api_key=None,
        settings={},
    )

    with pytest.raises(AgentCancelledError):
        await runtime.run(job_id=JOB_ID, model=model, evidence=bundle())

    assert finishes == [("failed", "JOB_CANCELLED")]
