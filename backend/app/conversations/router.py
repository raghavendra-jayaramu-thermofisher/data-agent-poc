from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_organization, get_current_user
from app.auth.models import User
from app.conversations.schemas import (
    ConversationCreate,
    ConversationDetailResponse,
    ConversationRename,
    ConversationResponse,
    MessageAcceptedResponse,
    MessageCreate,
    MessageResponse,
)
from app.conversations.service import ConversationService
from app.core.config import Settings, get_settings
from app.core.database import get_db_session
from app.core.redis import get_redis
from app.organizations.models import Organization, OrganizationMembership

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.post("", response_model=ConversationResponse, status_code=201)
async def create_conversation(
    payload: ConversationCreate,
    current_user: User = Depends(get_current_user),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ConversationResponse:
    organization, _ = context
    service = ConversationService(session, settings)
    item = await service.create(
        organization_id=organization.id,
        user_id=current_user.id,
        payload=payload,
    )
    return await service.to_response(item)


@router.get("", response_model=list[ConversationResponse])
async def list_conversations(
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> list[ConversationResponse]:
    organization, _ = context
    service = ConversationService(session, settings)
    rows = await service.list_for_org(organization.id)
    return [await service.to_response(item) for item in rows]


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: uuid.UUID,
    message_limit: int = Query(default=200, ge=1, le=500),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ConversationDetailResponse:
    organization, _ = context
    service = ConversationService(session, settings)
    item = await service.require_for_org(conversation_id, organization.id)
    base = await service.to_response(item)
    messages = await service.repo.list_messages(item.id, limit=message_limit)
    return ConversationDetailResponse(
        **base.model_dump(),
        messages=[MessageResponse.model_validate(message) for message in messages],
    )


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def rename_conversation(
    conversation_id: uuid.UUID,
    payload: ConversationRename,
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ConversationResponse:
    organization, _ = context
    service = ConversationService(session, settings)
    item = await service.rename(conversation_id, organization.id, payload)
    return await service.to_response(item)


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: uuid.UUID,
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> None:
    organization, _ = context
    service = ConversationService(session, settings)
    await service.delete(conversation_id, organization.id)


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(default=200, ge=1, le=500),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> list[MessageResponse]:
    organization, _ = context
    service = ConversationService(session, settings)
    await service.require_for_org(conversation_id, organization.id)
    rows = await service.repo.list_messages(conversation_id, limit=limit)
    return [MessageResponse.model_validate(row) for row in rows]


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageAcceptedResponse,
    status_code=202,
)
async def submit_message(
    conversation_id: uuid.UUID,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
    settings: Settings = Depends(get_settings),
) -> MessageAcceptedResponse:
    organization, _ = context
    message, job_id = await ConversationService(session, settings, redis=redis).submit_message(
        conversation_id=conversation_id,
        organization_id=organization.id,
        user_id=current_user.id,
        payload=payload,
    )
    return MessageAcceptedResponse(message_id=message.id, job_id=job_id)
