from __future__ import annotations

from types import SimpleNamespace

from app.agent.deep_agent import extract_final_answer, extract_usage


def test_extract_final_answer_ignores_tool_message() -> None:
    state = {
        "messages": [
            {"role": "tool", "content": '{"rows":[1]}'},
            {"role": "assistant", "content": "Final analysis"},
        ]
    }
    assert extract_final_answer(state) == "Final analysis"


def test_extract_final_answer_supports_content_blocks() -> None:
    message = SimpleNamespace(type="ai", content=[{"type": "text", "text": "Final"}, {"text": "answer"}])
    assert extract_final_answer({"messages": [message]}) == "Final\nanswer"


def test_extract_usage_uses_only_reported_values_and_does_not_invent_total() -> None:
    message = SimpleNamespace(
        usage_metadata={"input_tokens": 10, "output_tokens": 4},
        response_metadata={},
    )
    response = SimpleNamespace(
        llm_output=None,
        generations=[[SimpleNamespace(message=message)]],
    )
    assert extract_usage(response) == (10, 4, None)
