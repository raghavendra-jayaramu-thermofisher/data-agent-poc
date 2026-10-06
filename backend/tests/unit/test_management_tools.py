import uuid
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.agent import management_tools as module
from app.agent.evidence import EvidenceBundle, render_evidence_context, validate_evidence
from app.agent.tool_schemas import SaveSkillArgs
from app.agent.tools import AgentToolContext, AgentToolError
from app.core.config import Settings


@pytest.mark.parametrize(
    "message,kind,allowed",
    [
        ("Save this as a skill", "skills", True),
        ("Please save this format as a template.", "skills", True),
        ("Can you update the backlog skill?", "skills", True),
        ("Remember that P$ means planning dollars.", "knowledge", True),
        ("Use this format", "skills", False),
        ("Summarize the backlog", "knowledge", False),
        ("Do not save this as a skill", "skills", False),
        ('Explain the phrase "save this as a skill"', "skills", False),
    ],
)
def test_explicit_requests(message, kind, allowed):
    assert module.explicit_management_request(message, message, kind) is allowed


def test_fabricated_authorization_is_rejected():
    assert not module.explicit_management_request(
        "Summarize backlog", "Save this as a skill", "skills"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "role,message,quote,code",
    [
        ("member", "Save this as a skill", "Save this as a skill", "FORBIDDEN"),
        ("owner", "Use this format", "Use this format", "EXPLICIT_REQUEST_REQUIRED"),
        ("admin", "Summarize backlog", "Save this as a skill", "EXPLICIT_REQUEST_REQUIRED"),
        ("owner", "Save this as a skill", "Save this as a skill", None),
    ],
)
async def test_authorization_uses_job_actor_and_current_message(
    monkeypatch, role, message, quote, code
):
    org, convo, actor, message_id = [uuid.uuid4() for _ in range(4)]
    context = AgentToolContext(uuid.uuid4(), org, convo, frozenset(), Settings())
    job = SimpleNamespace(
        organization_id=org,
        conversation_id=convo,
        requested_by=actor,
        input={"user_message_id": str(message_id)},
    )
    job_repo = SimpleNamespace(get=AsyncMock(return_value=job))
    org_repo = SimpleNamespace(get_membership=AsyncMock(return_value=SimpleNamespace(role=role)))
    monkeypatch.setattr(module, "JobRepository", lambda session: job_repo)
    monkeypatch.setattr(module, "OrganizationRepository", lambda session: org_repo)
    session = SimpleNamespace(
        get=AsyncMock(
            return_value=SimpleNamespace(role="user", conversation_id=convo, content=message)
        )
    )
    if code:
        with pytest.raises(AgentToolError) as exc:
            await module._actor(session, context, {"authorization_quote": quote}, "skills")
        assert exc.value.code == code
    else:
        assert (
            await module._actor(session, context, {"authorization_quote": quote}, "skills") == actor
        )
        org_repo.get_membership.assert_awaited_once_with(org, actor)


def test_confirmed_management_actions_support_answers_without_sql():
    bundle = EvidenceBundle(uuid.uuid4(), "Save this as a skill", "Saved", (), (), False)
    assert validate_evidence(bundle)
    receipt = {
        "tool": "save_skill",
        "status": "succeeded",
        "result": {"name": "Backlog", "action": "created"},
    }
    saved = replace(bundle, management_results=(receipt,))
    assert validate_evidence(saved) == []
    assert "Backlog" in render_evidence_context(saved)


def test_skills_cannot_change_workspace_default_via_tool():
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        SaveSkillArgs(
            name="Backlog",
            content="Summarize changes",
            authorization_quote="Save this as a skill",
            is_default=True,
        )


@pytest.mark.asyncio
@pytest.mark.parametrize("handler", [module.save_knowledge])
async def test_management_cannot_access_unselected_datasource(handler):
    context = AgentToolContext(uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), frozenset(), Settings())
    with pytest.raises(AgentToolError) as error:
        await handler(context, {"data_source_id": str(uuid.uuid4())}, uuid.uuid4())
    assert error.value.code == "DATASOURCE_NOT_AUTHORIZED"
