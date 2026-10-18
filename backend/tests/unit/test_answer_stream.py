import asyncio
import uuid
from unittest.mock import AsyncMock

import pytest

from app.agent.answer_stream import AnswerStreamPublisher, preview_markdown
from app.agent.evidence import EvidenceBundle
from app.agent.final_answer import FinalAnswerError, FinalAnswerRuntime
from app.core.config import Settings
from app.models.client import (
    ModelCompletion,
    ModelRuntimeConfiguration,
    ModelStreamChunk,
    ModelStreamingUnsupportedError,
    ModelUsage,
)
from app.models.errors import ModelProviderError

JOB_ID = uuid.uuid4()
ARTIFACT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
MODEL = ModelRuntimeConfiguration(str(uuid.uuid4()), "writer", "https://model.invalid/v1", None, {})


@pytest.mark.parametrize("wrapper", [False, True])
def test_every_character_boundary_keeps_metadata_private_and_artifacts_complete(wrapper):
    answer = f"There are **12** orders. 🌍\n\n[[artifact:{ARTIFACT_ID}]]\n\nMore detail."
    body = f"```markdown\n{answer}\n```" if wrapper else answer
    body += "\n\n<follow_up_suggestions><suggestion>Private suggestion?</suggestion></follow_up_suggestions>"
    previous = ""
    for end in range(len(body) + 1):
        visible = preview_markdown(body[:end], frozenset({ARTIFACT_ID}))
        assert visible.startswith(previous), (end, previous, visible)
        assert "follow_up" not in visible and "Private suggestion" not in visible
        if "[[" in visible:
            assert f"[[artifact:{ARTIFACT_ID}]]" in visible
        previous = visible
    assert previous == answer


def test_inline_metadata_and_unknown_artifacts_are_not_published():
    assert preview_markdown("Answer <follow_up_sug", frozenset()) == "Answer"
    assert preview_markdown("Answer <follow_up_suggestions>Hidden", frozenset()) == "Answer"
    assert preview_markdown(f"Answer\n\n[[artifact:{ARTIFACT_ID}]]", frozenset()) == "Answer"


async def test_publisher_uses_javascript_offsets_for_emoji_and_appends_only_new_text():
    writer = AsyncMock()
    publisher = AnswerStreamPublisher(
        job_id=JOB_ID, stream_id=uuid.uuid4(), artifact_ids=frozenset(), write=writer
    )
    await publisher.start()
    publisher.raw = "Hi 🌍"
    await publisher.flush()
    publisher.raw += " again"
    await publisher.flush()
    await publisher.flush()
    deltas = [call.args[2] for call in writer.await_args_list if call.args[1] == "answer.delta"]
    assert [item["text"] for item in deltas] == ["Hi 🌍", " again"]
    assert [item["offset"] for item in deltas] == [0, 5]


@pytest.fixture
def runtime(monkeypatch):
    from app.agent import final_answer as module

    writer = AsyncMock()
    monkeypatch.setattr(module, "append_agent_event", writer)
    monkeypatch.setattr(
        FinalAnswerRuntime, "_start_execution", AsyncMock(return_value=uuid.uuid4())
    )
    monkeypatch.setattr(FinalAnswerRuntime, "_finish_execution", AsyncMock())
    from app.agent import tools

    monkeypatch.setattr(tools, "is_cancel_requested", AsyncMock(return_value=False))
    return writer


async def test_public_text_arrives_before_generation_finishes_and_suggestions_stay_hidden(runtime):
    first = asyncio.Event()
    finish = asyncio.Event()

    class Provider:
        async def stream_chat_completion(self, **kwargs):
            yield ModelStreamChunk("First finding. 🌍")
            first.set()
            await finish.wait()
            for char in "\n\nMore findings.\n<follow_up_suggestions><suggestion>Compare regions?</suggestion></follow_up_suggestions>":
                yield ModelStreamChunk(char)
            yield ModelStreamChunk(usage=ModelUsage(10, 20, 30))

    service = FinalAnswerRuntime(
        settings=Settings(_env_file=None), client_factory=lambda *_: Provider()
    )
    suggestions = []
    evidence = EvidenceBundle(
        job_id=JOB_ID,
        question="Summary",
        analyst_notes="No data available",
        sql_results=(),
        artifacts=(),
        unavailable_information=True,
    )
    task = asyncio.create_task(
        service.run(
            job_id=JOB_ID, model=MODEL, evidence=evidence, follow_up_suggestions=suggestions
        )
    )
    await asyncio.wait_for(first.wait(), 1)
    assert not task.done()
    deltas = [call.args[2] for call in runtime.await_args_list if call.args[1] == "answer.delta"]
    assert deltas[0]["text"] == "First finding. 🌍"
    finish.set()
    assert await task == "First finding. 🌍\n\nMore findings."
    assert suggestions == ["Compare regions?"]
    assert len([call for call in runtime.await_args_list if call.args[1] == "answer.delta"]) < 5
    assert FinalAnswerRuntime._finish_execution.await_args.kwargs["total_tokens"] == 30


async def test_periodic_flush_delivers_buffered_text_while_provider_pauses(runtime):
    pause = asyncio.Event()

    class Provider:
        async def stream_chat_completion(self, **kwargs):
            yield ModelStreamChunk("First")
            yield ModelStreamChunk(" and second")
            await pause.wait()

    service = FinalAnswerRuntime(settings=Settings(_env_file=None, final_answer_stream_flush_ms=50))
    task = asyncio.create_task(
        service._generate_completion(
            client=Provider(),
            job_id=JOB_ID,
            execution_id=uuid.uuid4(),
            model=MODEL,
            messages=[],
            artifact_ids=frozenset(),
        )
    )
    await asyncio.sleep(0.12)
    assert not task.done()
    assert (
        "".join(
            call.args[2]["text"]
            for call in runtime.await_args_list
            if call.args[1] == "answer.delta"
        )
        == "First and second"
    )
    pause.set()
    await task


async def test_only_explicit_rejection_before_output_allows_nonstreaming_fallback(runtime):
    class Provider:
        chat_completion = AsyncMock(return_value=ModelCompletion("Fallback", None, None))

        async def stream_chat_completion(self, **kwargs):
            raise ModelStreamingUnsupportedError("UNSUPPORTED", "Streaming not supported")
            yield  # noqa: unreachable-code

    provider = Provider()
    service = FinalAnswerRuntime(settings=Settings(_env_file=None))
    result = await service._generate_completion(
        client=provider,
        job_id=JOB_ID,
        execution_id=uuid.uuid4(),
        model=MODEL,
        messages=[],
        artifact_ids=frozenset(),
    )
    assert result.text == "Fallback"
    provider.chat_completion.assert_awaited_once()


async def test_midstream_failure_keeps_partial_preview_and_never_starts_another_request(runtime):
    class Provider:
        chat_completion = AsyncMock()

        async def stream_chat_completion(self, **kwargs):
            yield ModelStreamChunk("Partial answer")
            raise ModelProviderError("BROKEN", "Connection interrupted")

    provider = Provider()
    service = FinalAnswerRuntime(
        settings=Settings(_env_file=None), client_factory=lambda *_: provider
    )
    with pytest.raises(FinalAnswerError):
        await service._complete(job_id=JOB_ID, model=MODEL, messages=[])
    provider.chat_completion.assert_not_awaited()
    assert FinalAnswerRuntime._finish_execution.await_args.kwargs["status"] == "failed"
    assert any(call.args[1] == "answer.delta" for call in runtime.await_args_list)


async def test_timeout_closes_the_stream_and_does_not_report_fabricated_usage(runtime):
    closed = asyncio.Event()

    class Provider:
        async def stream_chat_completion(self, **kwargs):
            try:
                yield ModelStreamChunk("Partial answer")
                await asyncio.Event().wait()
            finally:
                closed.set()

    settings = Settings(_env_file=None).model_copy(update={"final_answer_timeout_seconds": 0.05})
    service = FinalAnswerRuntime(settings=settings, client_factory=lambda *_: Provider())
    with pytest.raises(FinalAnswerError) as failure:
        await service._complete(job_id=JOB_ID, model=MODEL, messages=[])
    assert failure.value.code == "FINAL_ANSWER_TIMEOUT"
    assert closed.is_set()
    assert FinalAnswerRuntime._finish_execution.await_args.kwargs.get("total_tokens") is None


async def test_streaming_can_be_disabled_without_changing_the_completion_path(runtime):
    provider = type(
        "Provider",
        (),
        {
            "chat_completion": AsyncMock(return_value=ModelCompletion("Answer", None, None)),
            "stream_chat_completion": AsyncMock(),
        },
    )()
    service = FinalAnswerRuntime(
        settings=Settings(_env_file=None, final_answer_streaming_enabled=False)
    )
    assert (
        await service._generate_completion(
            client=provider,
            job_id=JOB_ID,
            execution_id=uuid.uuid4(),
            model=MODEL,
            messages=[],
            artifact_ids=frozenset(),
        )
    ).text == "Answer"
    provider.stream_chat_completion.assert_not_called()
