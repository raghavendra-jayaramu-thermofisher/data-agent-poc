from types import SimpleNamespace

import pytest

from app.agent.final_answer_validation import answer_title, ensure_answer_title, fallback_title
from app.conversations.titles import adopt_answer_title, default_conversation_title


@pytest.mark.parametrize(
    "markdown,expected",
    [
        # A well-formed answer is unchanged.
        ("# Sales\n\n## Summary\nText.", "# Sales\n\n## Summary\nText."),
        # Content written before the title moves below it.
        ("Intro line.\n\n# Sales by region\n\nBody.", "# Sales by region\n\nIntro line.\n\n\nBody."),
        # Later level-1 headings become sections.
        ("# Title\n\nA\n\n# Second\n\nB", "# Title\n\nA\n\n## Second\n\nB"),
        # Closing hashes are decoration.
        ("# Title ##\n\nBody", "# Title\n\nBody"),
        # A setext level-1 heading counts as the title.
        ("Title\n=====\n\nBody", "# Title\n\nBody"),
    ],
)
def test_answers_keep_exactly_one_leading_title(markdown, expected):
    assert ensure_answer_title(markdown, "question") == expected


def test_missing_title_is_built_from_the_question():
    result = ensure_answer_title("## Result\n\nBody.", "/report  what were sales\nlast month?")
    assert result == "# What were sales last month\n\n## Result\n\nBody."


def test_headings_inside_code_blocks_are_not_titles():
    markdown = "```\n# not a title\n```\n\nBody."
    result = ensure_answer_title(markdown, "Show the query")
    assert result.startswith("# Show the query\n\n```\n# not a title\n```")


def test_empty_level_one_heading_is_replaced():
    assert ensure_answer_title("#\n\nBody.", "Count orders") == "# Count orders\n\nBody."


def test_answer_without_body_is_just_the_title():
    assert ensure_answer_title("# Only a title", "q") == "# Only a title"


@pytest.mark.parametrize(
    "question,expected",
    [
        ("how many customers?", "How many customers"),
        ("", "Analysis"),
        ("/weekly-report", "Analysis"),
        ("**bold** `code` question", "Bold code question"),
    ],
)
def test_fallback_title(question, expected):
    assert fallback_title(question) == expected


def test_fallback_title_is_shortened_at_a_word_boundary():
    title = fallback_title("word " * 40)
    assert len(title) <= 81 and title.endswith("…") and not title.endswith(" …")


def test_answer_title_reads_the_first_level_one_heading():
    assert answer_title("Intro\n\n# Main title\n\n# Other") == "Main title"
    assert answer_title("## Only a section") is None
    assert answer_title("```\n# code\n```") is None


@pytest.mark.parametrize(
    "current,expected,changed",
    [
        (None, "Answer title", True),
        (default_conversation_title("  what were  sales? "), "Answer title", True),
        ("My renamed chat", "My renamed chat", False),
        ("Earlier answer title", "Earlier answer title", False),
    ],
)
def test_conversation_adopts_the_first_answer_title_only_once(current, expected, changed):
    conversation = SimpleNamespace(title=current)
    assert adopt_answer_title(conversation, "  what were  sales? ", "Answer title") is changed
    assert conversation.title == expected


def test_conversation_title_is_kept_without_an_answer_title():
    conversation = SimpleNamespace(title="what were sales?")
    assert adopt_answer_title(conversation, "what were sales?", None) is False
    assert conversation.title == "what were sales?"
