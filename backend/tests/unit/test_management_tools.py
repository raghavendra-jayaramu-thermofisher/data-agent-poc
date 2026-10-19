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


SKILL = "# Weekly\n1. KPI cards\n2. Region matrix\n3. Insights"


@pytest.mark.parametrize(
    "edit,expected",
    [
        (
            {"op": "replace", "target_text": "Region matrix", "new_text": "Status matrix"},
            "# Weekly\n1. KPI cards\n2. Status matrix\n3. Insights",
        ),
        (
            {"op": "insert_after", "target_text": "KPI cards", "new_text": "1b. Trend chart"},
            "# Weekly\n1. KPI cards\n1b. Trend chart\n2. Region matrix\n3. Insights",
        ),
        (
            {"op": "insert_after", "target_text": "Insights", "new_text": "4. Actions"},
            SKILL + "\n4. Actions",
        ),
        ({"op": "append", "new_text": "4. Actions"}, SKILL + "\n4. Actions"),
        (
            {"op": "delete", "target_text": "2. Region matrix"},
            "# Weekly\n1. KPI cards\n3. Insights",
        ),
        (
            {"op": "delete", "target_text": "3. Insights"},
            "# Weekly\n1. KPI cards\n2. Region matrix",
        ),
        (
            {"op": "delete", "target_text": " cards"},
            "# Weekly\n1. KPI\n2. Region matrix\n3. Insights",
        ),
    ],
)
def test_skill_edits_change_only_the_targeted_text(edit, expected):
    edited, changes = module.apply_skill_edits(SKILL, [edit])
    assert edited == expected
    assert changes[0]["op"] == edit["op"]


def test_skill_edits_apply_in_order():
    edited, changes = module.apply_skill_edits(
        SKILL,
        [
            {"op": "replace", "target_text": "Insights", "new_text": "Key insights"},
            {"op": "insert_after", "target_text": "Key insights", "new_text": "4. Actions"},
        ],
    )
    assert edited.endswith("3. Key insights\n4. Actions")
    assert len(changes) == 2


@pytest.mark.parametrize(
    "target,code",
    [("Missing", "SKILL_EDIT_TARGET_NOT_FOUND"), ("\n", "SKILL_EDIT_TARGET_AMBIGUOUS")],
)
def test_skill_edits_require_a_unique_target(target, code):
    with pytest.raises(AgentToolError) as exc:
        module.apply_skill_edits(SKILL, [{"op": "delete", "target_text": target}])
    assert exc.value.code == code


def test_skill_edits_cannot_empty_the_skill():
    with pytest.raises(AgentToolError):
        module.apply_skill_edits("Only line", [{"op": "delete", "target_text": "Only line"}])


@pytest.mark.parametrize(
    "edit",
    [
        {"op": "replace", "target_text": "a"},
        {"op": "append", "target_text": "a", "new_text": "b"},
        {"op": "delete", "target_text": "a", "new_text": "b"},
        {"op": "insert_after", "new_text": "b"},
    ],
)
def test_skill_edit_schema_rejects_incomplete_operations(edit):
    from pydantic import ValidationError

    from app.agent.tool_schemas import SkillEdit

    with pytest.raises(ValidationError):
        SkillEdit.model_validate(edit)


def _edit_handler_setup(monkeypatch, content):
    item = SimpleNamespace(id=uuid.uuid4(), name="Weekly", command="weekly", content=content)
    service = SimpleNamespace(
        require_instruction=AsyncMock(return_value=item),
        update_instruction=AsyncMock(
            side_effect=lambda **kwargs: SimpleNamespace(
                id=item.id, name=item.name, command=item.command, content=kwargs["payload"].content
            )
        ),
    )
    session = SimpleNamespace(commit=AsyncMock())

    class Factory:
        async def __aenter__(self):
            return session

        async def __aexit__(self, *args):
            return False

    monkeypatch.setattr(module, "get_session_factory", lambda: Factory)
    monkeypatch.setattr(module, "_actor", AsyncMock(return_value=uuid.uuid4()))
    monkeypatch.setattr(module, "InstructionService", lambda session: service)
    monkeypatch.setattr(
        module, "AuditService", lambda session: SimpleNamespace(record=lambda **kwargs: None)
    )
    return item, service, session


@pytest.mark.asyncio
async def test_edit_skill_saves_only_the_changed_content(monkeypatch):
    item, service, session = _edit_handler_setup(monkeypatch, SKILL)
    context = AgentToolContext(uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), frozenset(), Settings())
    result = await module.edit_skill(
        context,
        {
            "instruction_id": str(item.id),
            "content_hash": module.content_hash(SKILL),
            "authorization_quote": "Add a line to the weekly skill",
            "edits": [{"op": "append", "target_text": None, "new_text": "4. Actions"}],
        },
        uuid.uuid4(),
    )
    saved = service.update_instruction.await_args.kwargs["payload"]
    assert saved.content == SKILL + "\n4. Actions"
    assert saved.name is None and "command" not in saved.model_fields_set
    assert result["action"] == "edited"
    assert result["content_hash"] == module.content_hash(SKILL + "\n4. Actions")
    assert "content" not in result
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_edit_skill_rejects_a_stale_read(monkeypatch):
    item, service, session = _edit_handler_setup(monkeypatch, SKILL + "\nchanged elsewhere")
    context = AgentToolContext(uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), frozenset(), Settings())
    with pytest.raises(AgentToolError) as exc:
        await module.edit_skill(
            context,
            {
                "instruction_id": str(item.id),
                "content_hash": module.content_hash(SKILL),
                "authorization_quote": "Edit the weekly skill",
                "edits": [{"op": "append", "target_text": None, "new_text": "4. Actions"}],
            },
            uuid.uuid4(),
        )
    assert exc.value.code == "SKILL_CHANGED"
    service.update_instruction.assert_not_awaited()
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_edit_skill_runs_through_the_registered_tool_contract(monkeypatch):
    from app.agent.tools import _safe_tool_input, build_default_tool_registry

    item, service, _ = _edit_handler_setup(monkeypatch, SKILL)
    monkeypatch.setattr(module, "InstructionService", lambda session: service)
    definition = next(t for t in build_default_tool_registry().all() if t.name == "edit_skill")
    raw = {
        "instruction_id": str(item.id),
        "content_hash": module.content_hash(SKILL),
        "authorization_quote": "Change step 2 in the weekly skill",
        "edits": [
            {"op": "replace", "target_text": "Region matrix", "new_text": "Status matrix"},
            {"op": "insert_after", "target_text": "3. Insights", "new_text": "4. Actions"},
        ],
    }
    arguments = definition.args_schema.model_validate(raw).model_dump(mode="json")
    context = AgentToolContext(uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), frozenset(), Settings())
    result = await definition.handler(context, arguments, uuid.uuid4())
    saved = service.update_instruction.await_args.kwargs["payload"].content
    assert saved == "# Weekly\n1. KPI cards\n2. Status matrix\n3. Insights\n4. Actions"
    assert [change["op"] for change in result["changes"]] == ["replace", "insert_after"]
    logged = _safe_tool_input("edit_skill", arguments)
    assert logged["edit_ops"] == ["replace", "insert_after"]
    assert "Status matrix" not in str(logged)


@pytest.mark.parametrize(
    "message",
    ["Add a line to the weekly skill", "Edit the weekly template", "Remove step 3 from the skill"],
)
def test_skill_edit_requests_are_explicit(message):
    assert module.explicit_management_request(message, message, "skills")


@pytest.mark.asyncio
@pytest.mark.parametrize("handler", [module.save_knowledge])
async def test_management_cannot_access_unselected_datasource(handler):
    context = AgentToolContext(uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), frozenset(), Settings())
    with pytest.raises(AgentToolError) as error:
        await handler(context, {"data_source_id": str(uuid.uuid4())}, uuid.uuid4())
    assert error.value.code == "DATASOURCE_NOT_AUTHORIZED"
