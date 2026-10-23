import json
import uuid
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.agent import jobs
from app.conversations.schemas import MessageResponse
from app.core.config import Settings


@pytest.mark.parametrize("retry", [False, True])
async def test_job_persists_suggestions_as_metadata_and_clean_answer(monkeypatch, retry):
    job_id, conversation_id, profile_id, org_id, source_id, question_id = [
        uuid.uuid4() for _ in range(6)
    ]
    session = AsyncMock()

    @asynccontextmanager
    async def factory():
        yield session

    monkeypatch.setattr(jobs, "get_session_factory", lambda: factory)
    monkeypatch.setattr(jobs, "get_settings", lambda: Settings(_env_file=None))
    scope = [
        {
            "data_source_id": str(source_id),
            "mode": "selected",
            "tables": [{"schema": "dbo", "name": "orders"}],
        }
    ]
    job = SimpleNamespace(
        id=job_id,
        created_at=jobs.utc_now(),
        job_type="chat_query",
        organization_id=org_id,
        input={
            "conversation_id": str(conversation_id),
            "model_profile_id": str(profile_id),
            "table_scope": scope,
            "user_message_id": str(question_id),
        },
    )
    monkeypatch.setattr(jobs.JobRepository, "get", AsyncMock(return_value=job))
    conversation = SimpleNamespace(id=conversation_id, table_scope=scope, title="Count orders")
    monkeypatch.setattr(
        jobs.ConversationRepository, "get_for_org", AsyncMock(return_value=conversation)
    )
    monkeypatch.setattr(
        jobs.ConversationRepository,
        "first_user_message",
        AsyncMock(return_value=SimpleNamespace(content="Count orders")),
    )
    monkeypatch.setattr(
        jobs.ConversationRepository, "source_ids", AsyncMock(return_value=[source_id])
    )
    monkeypatch.setattr(
        jobs.ConversationRepository,
        "recent_messages",
        AsyncMock(
            return_value=[
                    SimpleNamespace(
                        id=question_id, role="user", content="Count orders",
                        metadata_json={}, job_id=job_id,
                    ),
                # Even a stale/broad history provider cannot redirect this job to a newer question.
                    SimpleNamespace(
                        id=uuid.uuid4(), role="user", content="Unrelated later question",
                        metadata_json={}, job_id=uuid.uuid4(),
                    ),
            ]
        ),
    )
    monkeypatch.setattr(jobs.InstructionRepository, "get_default", AsyncMock(return_value=None))
    monkeypatch.setattr(
        jobs.ModelConfigurationService,
        "get_runtime_configuration",
        AsyncMock(return_value=SimpleNamespace()),
    )
    analysis = AsyncMock(
        return_value=SimpleNamespace(notes="Verified orders", messages=[], clarification=None)
    )
    monkeypatch.setattr(jobs.DeepAgentRuntime, "run", analysis)
    monkeypatch.setattr(jobs, "_load_evidence", AsyncMock(return_value=SimpleNamespace()))
    monkeypatch.setattr(jobs, "validate_evidence", lambda _evidence: [])
    monkeypatch.setattr(jobs, "is_cancel_requested", AsyncMock(return_value=False))

    async def finalize(**kwargs):
        context = json.loads(kwargs["follow_up_context"])
        assert context["table_scope"] == [dict(scope[0], knowledge_version_id=None)]
        assert "Count orders" in context["recent_questions"]
        kwargs["follow_up_suggestions"][:] = ["Compare orders by region?"]
        return "# Open orders\n\nThere are 12 orders."

    finalizer = AsyncMock(side_effect=finalize)
    monkeypatch.setattr(jobs.FinalAnswerRuntime, "run", finalizer)
    existing = (
        jobs.Message(
            id=uuid.uuid4(),
            conversation_id=conversation_id,
            role="assistant",
            content="Old answer",
            job_id=job_id,
            metadata_json={"follow_up_suggestions": ["Old question?"]},
            created_at=jobs.utc_now(),
        )
        if retry
        else None
    )
    monkeypatch.setattr(
        jobs.ConversationRepository, "message_for_job", AsyncMock(return_value=existing)
    )
    saved_messages = []
    monkeypatch.setattr(
        jobs.ConversationRepository,
        "add_message",
        lambda _repo, message: saved_messages.append(message),
    )
    existing_artifact = SimpleNamespace(payload={}) if retry else None
    monkeypatch.setattr(
        jobs.AgentExecutionRepository,
        "answer_artifact_for_job",
        AsyncMock(return_value=existing_artifact),
    )
    saved_artifacts = []
    monkeypatch.setattr(
        jobs.AgentExecutionRepository,
        "add_artifact",
        lambda _repo, artifact: saved_artifacts.append(artifact),
    )
    for method in ["list_tools", "list_sql", "list_artifacts"]:
        monkeypatch.setattr(jobs.AgentExecutionRepository, method, AsyncMock(return_value=[]))
    await jobs.run_chat_query_job(job_id)
    message = existing if retry else saved_messages[0]
    message.id = message.id or uuid.uuid4()
    assert message.content == "# Open orders\n\nThere are 12 orders."
    assert message.metadata_json["title"] == "Open orders"
    # The conversation still had its automatic title, so the first answer names it.
    assert conversation.title == "Open orders"
    assert message.metadata_json["follow_up_suggestions"] == ["Compare orders by region?"]
    assert MessageResponse.model_validate(message).metadata["follow_up_suggestions"] == [
        "Compare orders by region?"
    ]
    artifact = existing_artifact if retry else saved_artifacts[0]
    assert artifact.payload["markdown"] == message.content
    assert len(saved_messages) == (0 if retry else 1)
    analysis.assert_awaited_once()
    assert analysis.call_args.kwargs["history"][-1] == {
        "role": "user", "content": "Count orders"
    }
    assert jobs._load_evidence.call_args.kwargs["question"] == "Count orders"
    finalizer.assert_awaited_once()
    session.commit.assert_awaited_once()


async def test_model_history_does_not_include_suggestions_metadata():
    message = SimpleNamespace(
        role="assistant",
        content="There are 12 orders.",
        job_id=None,
        metadata_json={"follow_up_suggestions": ["Compare regions?"]},
    )
    assert await jobs._model_history([message], Mock()) == [
        {"role": "assistant", "content": "There are 12 orders."}
    ]
