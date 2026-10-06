from __future__ import annotations

import re
import uuid
from typing import Any

from app.agent.tools import AgentToolContext, AgentToolError, _parse_source_id
from app.audit.service import AuditService
from app.conversations.models import Message
from app.core.database import get_session_factory
from app.core.errors import AppError
from app.instructions.schemas import InstructionCreate, InstructionUpdate
from app.instructions.service import InstructionService
from app.jobs.repository import JobRepository
from app.knowledge.schemas import KnowledgeAnnotationCreate, KnowledgeAnnotationUpdate
from app.knowledge.service import KnowledgeService
from app.organizations.repository import OrganizationRepository


def explicit_management_request(message: str, quote: str, kind: str) -> bool:
    """Accept direct save requests in the current message, never source-text quotes."""
    if quote not in message:
        return False
    # Require a direct request at the start of a line/sentence. This intentionally fails closed
    # for ambiguous wording; the agent can ask the user to state their save request explicitly.
    prefix = r"(?:please\s+|can you\s+|could you\s+|would you\s+|i want you to\s+)*"
    verbs = {
        "knowledge": r"(?:save|remember|add|create|update|record|store)",
        "skills": r"(?:save|create|update|store|add)",
    }
    pattern = rf"(?:^|[.!?]\s+|\n){prefix}{verbs[kind]}\b[^.!?\n]*"
    for match in re.finditer(pattern, message, re.IGNORECASE):
        request = match.group().strip(" .!?\n")
        if quote.strip() not in request and request not in quote.strip():
            continue
        if kind == "knowledge":
            return True
        domain = r"\b(?:skill|template|format)\b"
        if re.search(domain, request, re.IGNORECASE):
            return True
    return False


async def _actor(
    session: Any, context: AgentToolContext, arguments: dict[str, object], kind: str
) -> uuid.UUID:
    job = await JobRepository(session).get(context.job_id)
    if (
        job is None
        or job.organization_id != context.organization_id
        or job.conversation_id != context.conversation_id
    ):
        raise AgentToolError("JOB_NOT_FOUND", "This request is unavailable.")
    membership = await OrganizationRepository(session).get_membership(
        context.organization_id, job.requested_by
    )
    if membership is None or membership.role not in {"owner", "admin"}:
        raise AgentToolError(
            "FORBIDDEN", "Only workspace owners and admins can save knowledge or skills."
        )
    try:
        message = await session.get(Message, uuid.UUID(str(job.input["user_message_id"])))
    except (KeyError, ValueError, TypeError):
        message = None
    if (
        message is None
        or message.role != "user"
        or message.conversation_id != context.conversation_id
        or not explicit_management_request(
            message.content, str(arguments.get("authorization_quote") or ""), kind
        )
    ):
        raise AgentToolError(
            "EXPLICIT_REQUEST_REQUIRED",
            "Ask explicitly in your current message to save business knowledge or a skill.",
        )
    return job.requested_by


async def read_saved_context(
    context: AgentToolContext, arguments: dict[str, object], _tool_id: uuid.UUID
) -> dict[str, object]:
    item_id = uuid.UUID(str(arguments["item_id"])) if arguments.get("item_id") else None
    async with get_session_factory()() as session:
        if arguments["kind"] == "skills":
            items = await InstructionService(session).list_instructions(context.organization_id)

            def serialize(item: Any) -> dict[str, object]:
                return {
                    "id": str(item.id),
                    "name": item.name,
                    "command": item.command,
                    "is_default": item.is_default,
                    "content": item.content if item_id else item.content[:1000],
                }
        else:
            source_id = _parse_source_id(context, arguments)
            service = KnowledgeService(session, context.settings)
            await service.require_source(source_id, context.organization_id)
            base = await service.repo.get_base_for_source(source_id, context.organization_id)
            items = await service.repo.list_annotations(base.id) if base else []

            def serialize(item: Any) -> dict[str, object]:
                return {
                    "id": str(item.id),
                    "scope_type": item.scope_type,
                    "scope_key": item.scope_key,
                    "content": item.content if item_id else item.content[:1000],
                }

        if item_id:
            items = [item for item in items if item.id == item_id]
            if not items:
                raise AgentToolError(
                    "SAVED_ITEM_NOT_FOUND",
                    "The saved item is unavailable in this workspace and datasource.",
                )
        return {
            "ok": True,
            "kind": arguments["kind"],
            "items": [serialize(item) for item in items[:100]],
            "truncated": len(items) > 100,
            "summaries": item_id is None,
        }


async def save_knowledge(
    context: AgentToolContext, arguments: dict[str, object], _tool_id: uuid.UUID
) -> dict[str, object]:
    source_id = _parse_source_id(context, arguments)
    async with get_session_factory()() as session:
        user_id = await _actor(session, context, arguments, "knowledge")
        service = KnowledgeService(session, context.settings)
        await service.require_source(source_id, context.organization_id)
        payload = KnowledgeAnnotationCreate(
            scope_type=arguments["scope_type"],
            scope_key=arguments.get("scope_key"),
            content=arguments["content"],
        )
        if not payload.content:
            raise AgentToolError("TOOL_ARGUMENT_INVALID", "Knowledge content must contain text.")
        base = await service.ensure_base(source_id, context.organization_id)
        annotation_id = arguments.get("annotation_id")
        try:
            if annotation_id:
                item = await service.repo.get_annotation_for_org(
                    uuid.UUID(str(annotation_id)), context.organization_id
                )
                if item is None or item.knowledge_base_id != base.id:
                    raise AgentToolError(
                        "KNOWLEDGE_ANNOTATION_NOT_FOUND",
                        "The note is unavailable for this datasource.",
                    )
                if item.scope_type != payload.scope_type or item.scope_key != payload.scope_key:
                    raise AgentToolError(
                        "KNOWLEDGE_SCOPE_MISMATCH",
                        "Keep the existing note's scope when updating it.",
                    )
                item = await service.update_annotation(
                    annotation_id=item.id,
                    organization_id=context.organization_id,
                    payload=KnowledgeAnnotationUpdate(content=payload.content),
                )
                action = "updated"
            else:
                existing = await service.repo.list_annotations(base.id)
                item = next(
                    (
                        note
                        for note in existing
                        if note.scope_type == payload.scope_type
                        and note.scope_key == payload.scope_key
                        and note.content == payload.content
                    ),
                    None,
                )
                action = "unchanged" if item else "created"
                if item is None:
                    item = await service.create_annotation(
                        data_source_id=source_id,
                        organization_id=context.organization_id,
                        user_id=user_id,
                        payload=payload,
                    )
        except AppError as exc:
            raise AgentToolError(exc.code, exc.message) from exc
        item_id = item.id
        AuditService(session).record(
            organization_id=context.organization_id,
            user_id=user_id,
            action=f"knowledge.annotation.{action}",
            resource_type="knowledge_annotation",
            resource_id=item_id,
            metadata={"chat_job_id": str(context.job_id)},
        )
        await session.commit()
        return {
            "ok": True,
            "action": action,
            "kind": "knowledge",
            "annotation_id": str(item_id),
            "data_source_id": str(source_id),
            "scope_type": payload.scope_type,
            "scope_key": payload.scope_key,
            "content": payload.content,
            "url": f"/knowledge/{source_id}",
        }


async def save_skill(
    context: AgentToolContext, arguments: dict[str, object], _tool_id: uuid.UUID
) -> dict[str, object]:
    async with get_session_factory()() as session:
        user_id = await _actor(session, context, arguments, "skills")
        service = InstructionService(session)
        payload = InstructionCreate(
            name=arguments["name"],
            content=arguments["content"],
            command=arguments.get("command"),
            is_default=False,
        )
        try:
            if arguments.get("instruction_id"):
                item = await service.update_instruction(
                    instruction_id=uuid.UUID(str(arguments["instruction_id"])),
                    organization_id=context.organization_id,
                    payload=InstructionUpdate(
                        name=payload.name,
                        content=payload.content,
                        **({"command": payload.command} if payload.command is not None else {}),
                    ),
                )
                action = "updated"
            else:
                item = await service.repo.find_by_name(context.organization_id, payload.name)
                if item and item.content == payload.content and item.command == payload.command:
                    action = "unchanged"
                else:
                    item = await service.create_instruction(
                        organization_id=context.organization_id,
                        user_id=user_id,
                        payload=payload,
                    )
                    action = "created"
        except AppError as exc:
            raise AgentToolError(exc.code, exc.message) from exc
        item_id, name, command, content = item.id, item.name, item.command, item.content
        AuditService(session).record(
            organization_id=context.organization_id,
            user_id=user_id,
            action=f"agent_instruction.{action}",
            resource_type="agent_instruction",
            resource_id=item_id,
            metadata={"chat_job_id": str(context.job_id)},
        )
        await session.commit()
        return {
            "ok": True,
            "action": action,
            "kind": "skill",
            "instruction_id": str(item_id),
            "name": name,
            "command": command,
            "content": content,
            "url": "/skills",
        }
