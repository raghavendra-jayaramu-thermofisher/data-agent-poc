"""Clarifying questions the agent asks before answering, and the user's answers.

A request ends the current turn with a question card. The answers arrive as the next user message,
whose readable text and expanded prompt carry the original request plus every answer, so the next
turn has the full context in ordinary conversation history.
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.errors import AppError

MAX_QUESTIONS = 4
MIN_OPTIONS, MAX_OPTIONS = 2, 6
MAX_ROUNDS = 2
OTHER_LABEL = "Other"
ANSWER_TEXT_MAX = 2000
# Server-added optional box on every card for context the questions did not cover.
EXTRA_QUESTION_ID = "additional_context"
EXTRA_QUESTION = {
    "id": EXTRA_QUESTION_ID,
    "kind": "text",
    "prompt": "Anything else I should know?",
    "required": False,
    "placeholder": "Definitions, exceptions or context the questions didn't cover",
    "is_extra": True,
}

_OTHER_LABELS = {"other", "others", "something else", "other (please specify)"}


class ClarificationOption(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=240)
    # Set only on the option the server appends; the UI pairs it with a text box.
    is_other: bool = False


class ClarificationQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[a-z][a-z0-9_]{0,39}$")
    kind: Literal["choice", "text"]
    prompt: str = Field(min_length=1, max_length=300)
    multiple: bool = False
    required: bool = True
    options: list[ClarificationOption] = Field(default_factory=list, max_length=MAX_OPTIONS + 1)
    placeholder: str | None = Field(default=None, max_length=120)


class AskUserArgs(BaseModel):
    """Arguments the model sends to `ask_user`."""

    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=1, max_length=400)
    questions: list[ClarificationQuestion] = Field(min_length=1, max_length=MAX_QUESTIONS)


class ClarificationAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: str = Field(min_length=1, max_length=40)
    selected: list[str] = Field(default_factory=list, max_length=MAX_OPTIONS + 1)
    other_text: str | None = Field(default=None, max_length=ANSWER_TEXT_MAX)
    text: str | None = Field(default=None, max_length=ANSWER_TEXT_MAX)

    @field_validator("other_text", "text")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        return (value or "").strip() or None


class ClarificationAnswers(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answers: list[ClarificationAnswer] = Field(max_length=MAX_QUESTIONS + 1)

    @model_validator(mode="after")
    def unique_questions(self) -> ClarificationAnswers:
        ids = [answer.question_id for answer in self.answers]
        if len(ids) != len(set(ids)):
            raise ValueError("Each question may be answered once.")
        return self


class ClarificationError(ValueError):
    """A request the model can correct; the message is returned to it as a tool error."""


def _is_other(label: str) -> bool:
    return re.sub(r"\s+", " ", label.strip().casefold()).rstrip(".:") in _OTHER_LABELS


def build_request(args: AskUserArgs) -> dict[str, object]:
    """Validate the model's questions and append the server-owned "Other" option."""
    ids = [question.id for question in args.questions]
    if len(ids) != len(set(ids)):
        raise ClarificationError("Question ids must be unique.")
    if EXTRA_QUESTION_ID in ids:
        raise ClarificationError(
            f"'{EXTRA_QUESTION_ID}' is reserved; the interface adds that box automatically."
        )
    questions: list[dict[str, object]] = []
    for question in args.questions:
        if question.kind == "text":
            if question.options or question.multiple:
                raise ClarificationError(
                    f"Text question '{question.id}' must not have options or multiple selection."
                )
            questions.append(question.model_dump(exclude={"options", "multiple"}))
            continue
        options = [option for option in question.options if not _is_other(option.label)]
        labels = [option.label.strip().casefold() for option in options]
        if len(labels) != len(set(labels)):
            raise ClarificationError(f"Choice question '{question.id}' repeats an option.")
        if not MIN_OPTIONS <= len(options) <= MAX_OPTIONS:
            raise ClarificationError(
                f"Choice question '{question.id}' needs {MIN_OPTIONS}-{MAX_OPTIONS} concrete "
                "options; the interface always adds 'Other'."
            )
        item = question.model_dump(exclude={"placeholder"})
        item["options"] = [
            *(option.model_dump(exclude={"is_other"}) for option in options),
            {"label": OTHER_LABEL, "description": None, "is_other": True},
        ]
        questions.append(item)
    questions.append(dict(EXTRA_QUESTION))
    return {"schema_version": 1, "reason": args.reason.strip(), "questions": questions}


def validate_answers(
    request: dict[str, object], submitted: ClarificationAnswers
) -> list[dict[str, object]]:
    """Check answers against the stored questions; returns answers in question order."""
    questions = request.get("questions")
    if not isinstance(questions, list):
        raise AppError("CLARIFICATION_INVALID", "The stored questions are invalid.", 422)
    by_id = {answer.question_id: answer for answer in submitted.answers}
    known = {str(question.get("id")) for question in questions}
    errors: dict[str, str] = {
        answer_id: "Unknown question." for answer_id in by_id if answer_id not in known
    }
    normalized: list[dict[str, object]] = []
    for question in questions:
        question_id = str(question["id"])
        answer = by_id.get(question_id) or ClarificationAnswer(question_id=question_id)
        required = question.get("required", True) is not False
        if question["kind"] == "text":
            if required and not answer.text:
                errors[question_id] = "An answer is required."
            normalized.append({"question_id": question_id, "text": answer.text})
            continue
        labels = {str(option["label"]) for option in question.get("options", [])}
        selected = list(dict.fromkeys(answer.selected))
        if any(label not in labels for label in selected):
            errors[question_id] = "Choose from the listed options."
        elif not question.get("multiple") and len(selected) > 1:
            errors[question_id] = "Choose one option."
        elif required and not selected:
            errors[question_id] = "Choose an option."
        elif OTHER_LABEL in selected and not answer.other_text:
            errors[question_id] = "Describe your answer for 'Other'."
        normalized.append({
            "question_id": question_id,
            "selected": selected,
            "other_text": answer.other_text if OTHER_LABEL in selected else None,
        })
    if errors:
        raise AppError(
            "CLARIFICATION_ANSWER_INVALID", "Some answers need attention.", 422, field_errors=errors
        )
    return normalized


def questions_markdown(request: dict[str, object]) -> str:
    """Readable form of the questions, kept as the assistant message content and history."""
    lines = ["# A few questions before I continue", "", str(request.get("reason", "")).strip(), ""]
    asked = [item for item in request.get("questions", []) if not item.get("is_extra")]
    for index, question in enumerate(asked, start=1):
        if question["kind"] == "text":
            lines.append(f"{index}. **{question['prompt']}** (free text)")
        else:
            options = ", ".join(str(option["label"]) for option in question["options"])
            mode = "choose any" if question.get("multiple") else "choose one"
            lines.append(f"{index}. **{question['prompt']}** ({mode}: {options})")
    return "\n".join(lines).strip()


def answers_text(request: dict[str, object], answers: list[dict[str, object]]) -> str:
    """Readable answers, shown in the user's chat bubble and sent to the model."""
    by_id = {answer["question_id"]: answer for answer in answers}
    lines = ["Answers to your questions:"]
    for question in request.get("questions", []):
        answer = by_id.get(question["id"], {})
        if question.get("is_extra"):
            if answer.get("text"):
                lines.append(f"- Additional context: {answer['text']}")
            continue
        if question["kind"] == "text":
            value = answer.get("text") or "(no answer)"
        else:
            chosen = [
                f"Other: {answer.get('other_text')}" if label == OTHER_LABEL else label
                for label in answer.get("selected") or []
            ]
            value = "; ".join(chosen) or "(no answer)"
        lines.append(f"- {question['prompt']} {value}")
    return "\n".join(lines)
