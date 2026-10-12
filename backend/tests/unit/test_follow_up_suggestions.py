import pytest

from app.agent.follow_up_suggestions import extract_follow_up_suggestions


def test_extracts_normalizes_deduplicates_without_a_three_question_limit():
    answer, questions = extract_follow_up_suggestions(
        "# Report\n\nRevenue rose.\n\n<follow_up_suggestions>"
        "<suggestion> Compare  regions &amp; countries. </suggestion>"
        "<suggestion>compare regions &amp; countries.</suggestion>"
        "<suggestion>Show last week.</suggestion><suggestion>Show aging.</suggestion>"
        "<suggestion>Show orders.</suggestion></follow_up_suggestions>"
    )
    assert answer == "# Report\n\nRevenue rose."
    assert questions == [
        "Compare regions & countries.",
        "Show last week.",
        "Show aging.",
        "Show orders.",
    ]


def test_keeps_longer_questions_when_context_is_needed():
    question = (
        "Which orders explain the change, considering the selected snapshot and exclusions? " * 4
    )
    _, questions = extract_follow_up_suggestions(
        f"Answer.\n<follow_up_suggestions><suggestion>{question}</suggestion></follow_up_suggestions>"
    )
    assert questions == [question.strip()]


@pytest.mark.parametrize(
    "block",
    [
        "<follow_up_suggestions></follow_up_suggestions>",
        "<follow_up_suggestions><suggestion>Incomplete",
        "<follow_up_suggestions><suggestion>Q</suggestion></follow_up_suggestions>extra",
        "<follow_up_suggestions><suggestion><script>Q</script></suggestion></follow_up_suggestions>",
        "<follow_up_suggestions><suggestion href='bad'>Q</suggestion></follow_up_suggestions>",
        "<follow_up_suggestions><!-- bad --><suggestion>Q</suggestion></follow_up_suggestions>",
        "<follow_up_suggestions><suggestion>" + "x" * 601 + "</suggestion></follow_up_suggestions>",
        "<follow_up_suggestions>" + "x" * 8193,
    ],
)
def test_invalid_optional_metadata_does_not_damage_answer(block):
    assert extract_follow_up_suggestions("Answer.\n\n" + block) == ("Answer.", [])


def test_existing_answers_without_suggestions_are_unchanged():
    assert extract_follow_up_suggestions("# Answer\n\nText.") == ("# Answer\n\nText.", [])
