"""Conversation titles: automatic from the first question, then named by the first answer."""

from __future__ import annotations

from app.conversations.models import Conversation

TITLE_MAX_LENGTH = 240


def default_conversation_title(content: str) -> str:
    """Title given to a new conversation from its first question, until an answer names it."""
    compact = " ".join(content.split())
    return compact[: TITLE_MAX_LENGTH - 3] + "..." if len(compact) > TITLE_MAX_LENGTH else compact


def adopt_answer_title(
    conversation: Conversation, first_question: str | None, answer_title: str | None
) -> bool:
    """Name the conversation after an answer's title while it still has its automatic title.

    A title the user set is never replaced, and once an answer has named the conversation the
    automatic title no longer matches, so later answers leave it unchanged.
    """
    if not answer_title or first_question is None:
        return False
    if conversation.title is not None and conversation.title != default_conversation_title(
        first_question
    ):
        return False
    conversation.title = answer_title[:TITLE_MAX_LENGTH]
    return True
