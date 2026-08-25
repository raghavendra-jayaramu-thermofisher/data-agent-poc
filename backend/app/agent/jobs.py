from __future__ import annotations

import uuid

from app.agent.deep_agent import DeepAgentDependencyError, DeepAgentRuntime
from app.agent.models import JobArtifact
from app.agent.repository import AgentExecutionRepository
from app.agent.tools import AgentCancelledError, AgentLimitError, AgentToolContext
from app.conversations.models import Message
from app.conversations.repository import ConversationRepository
from app.core.config import get_settings
from app.core.database import get_session_factory
from app.core.time import utc_now
from app.jobs.handlers import JobHandlerRegistry
from app.jobs.repository import JobRepository
from app.jobs.worker import JobFailureError
from app.models.service import ModelConfigurationService


async def run_chat_query_job(job_id: uuid.UUID) -> dict[str, object]:
    settings = get_settings()
    async with get_session_factory()() as session:
        job = await JobRepository(session).get(job_id)
        if job is None:
            raise JobFailureError("JOB_NOT_FOUND", "The analytical job no longer exists.")
        if job.job_type != "chat_query":
            raise JobFailureError("JOB_TYPE_INVALID", "The analytical job type is invalid.")
        raw_conversation_id = job.input.get("conversation_id")
        raw_profile_id = job.input.get("model_profile_id")
        try:
            conversation_id = uuid.UUID(str(raw_conversation_id))
            profile_id = uuid.UUID(str(raw_profile_id))
        except (TypeError, ValueError, AttributeError) as exc:
            raise JobFailureError("JOB_INPUT_INVALID", "The analytical job input is invalid.") from exc

        convo_repo = ConversationRepository(session)
        conversation = await convo_repo.get_for_org(conversation_id, job.organization_id)
        if conversation is None:
            raise JobFailureError("CONVERSATION_NOT_FOUND", "Conversation not found.")
        source_ids = await convo_repo.source_ids(conversation.id)
        if not source_ids:
            raise JobFailureError("CONVERSATION_DATASOURCE_REQUIRED", "The conversation has no datasource.")
        messages = await convo_repo.recent_messages(
            conversation.id, settings.agent_max_history_messages
        )
        history = [{"role": item.role, "content": item.content} for item in messages]
        runtime_model = await ModelConfigurationService(
            session, settings
        ).get_runtime_configuration(
            profile_id=profile_id,
            organization_id=job.organization_id,
        )
        organization_id = job.organization_id

    context = AgentToolContext(
        job_id=job_id,
        organization_id=organization_id,
        conversation_id=conversation_id,
        allowed_data_source_ids=frozenset(source_ids),
        settings=settings,
    )
    try:
        answer = await DeepAgentRuntime().run(
            context=context,
            model=runtime_model,
            history=history,
        )
    except AgentCancelledError as exc:
        raise JobFailureError("JOB_CANCELLED", "The analytical job was cancelled.") from exc
    except AgentLimitError as exc:
        raise JobFailureError(exc.code, exc.public_message) from exc
    except DeepAgentDependencyError as exc:
        raise JobFailureError(
            "AGENT_RUNTIME_UNAVAILABLE",
            "The Deep Agents runtime is unavailable on this server.",
        ) from exc
    except JobFailureError:
        raise
    except Exception as exc:
        # Never leak provider/LangGraph internals to API-visible job errors.
        raise JobFailureError(
            "AGENT_EXECUTION_FAILED",
            "The analytical agent failed to complete the request.",
        ) from exc

    async with get_session_factory()() as session:
        repo = ConversationRepository(session)
        existing = await repo.message_for_job(job_id, "assistant")
        if existing is None:
            message = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=answer,
                job_id=job_id,
                metadata_json={"runtime": "deepagents", "model_profile_id": str(profile_id)},
                created_at=utc_now(),
            )
            repo.add_message(message)
        else:
            message = existing
            message.content = answer
            message.metadata_json = {
                "runtime": "deepagents",
                "model_profile_id": str(profile_id),
            }

        execution_repo = AgentExecutionRepository(session)
        text_artifact = JobArtifact(
            job_id=job_id,
            kind="text",
            name="Answer",
            source_sql_execution_id=None,
            payload={"schema_version": 1, "markdown": answer},
            created_at=utc_now(),
        )
        execution_repo.add_artifact(text_artifact)
        await session.commit()
        tools = await execution_repo.list_tools(job_id)
        sql = await execution_repo.list_sql(job_id)
        artifacts = await execution_repo.list_artifacts(job_id)

    return {
        "conversation_id": str(conversation_id),
        "assistant_message_id": str(message.id),
        "tool_execution_count": len(tools),
        "sql_execution_count": len(sql),
        "artifact_ids": [str(item.id) for item in artifacts],
    }


def register_agent_handlers(registry: JobHandlerRegistry) -> None:
    if registry.get("chat_query") is None:
        registry.register("chat_query", run_chat_query_job)
