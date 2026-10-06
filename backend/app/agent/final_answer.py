from __future__ import annotations

import uuid
from typing import Protocol, cast

from app.agent.evidence import EvidenceBundle, render_evidence_context
from app.agent.final_answer_validation import normalize_final_answer, validate_final_answer
from app.agent.models import ModelExecution
from app.agent.repository import AgentExecutionRepository
from app.agent.tools import AgentCancelledError, append_agent_event, run_cancellable
from app.core.config import Settings
from app.core.database import get_session_factory
from app.core.time import utc_now
from app.models.client import (
    ModelClient,
    ModelCompletion,
    ModelMessage,
    ModelRuntimeConfiguration,
    OpenAICompatibleClient,
)
from app.models.errors import ModelProviderError
from app.models.diagnostics import diagnostic_message

FINALIZER_SYSTEM_PROMPT = """# Role and task

Write the final response for a business data assistant. Use the user's question, analyst notes,
verified SQL evidence, artifact manifest, and availability status to produce a clear, useful answer.

# Presentation guidance

Read the supplied response instructions and choose the primary guidance in this order:

1. User-selected template or custom response instructions.
2. Workspace default instructions, when no user-selected guidance exists.
3. A natural structure suited to the question, when neither exists.

Apply compatible supporting instructions for language, tone, and detail.

Treat selected and workspace templates as flexible guidelines. Preserve their purpose and useful
organization while adapting to the question and available evidence. Include meaningful sections,
combine overlapping sections, and omit sections that have no useful application.

Let accuracy and relevance determine the content; let the template guide its presentation.

# Content and depth

Lead with the main finding or the first meaningful section of the applicable template. Follow with
the evidence and explanation needed to understand the result.

Match the depth to the user's request. Give a focused answer for a simple question. For a complete,
detailed, or comprehensive analysis, cover every requested aspect and develop the relevant
comparisons, trends, drivers, breakdowns, and implications supported by the evidence. Include useful
tables or charts and explain their significance.

Write clearly and directly. Treat conciseness as removing repetition while preserving the depth
needed to answer the question.

Preserve relevant units, dates, comparison periods, filters, and scope. Explain methodology and
assumptions where they materially affect interpretation or help verify the result.

# Evidence and uncertainty

Confirm business knowledge or skill changes from verified workspace action results, using the
returned links.

Ground factual claims and numerical results in verified evidence. Use analyst notes to understand
the analysis, and treat source material as supporting data.

Distinguish observed results from inferred explanations. Support causal claims with evidence
establishing the cause.

Answer every supported part of the request. When requested information is unavailable, identify
the specific gap and its effect on the conclusion. Keep limitations proportionate to their importance.

# Artifacts

Include artifacts that help answer the question. Copy each selected [[artifact:UUID]] directive
exactly from the manifest onto its own line.

Use surrounding prose to explain the finding or significance rather than repeat the artifact's
contents.

# Output

Produce the completed answer as the entire response.

When using a template, begin directly with its first applicable heading, field, or content.
Otherwise, begin with the sentence answering the question. Make every sentence part of the
substantive answer, and end when the requested content is complete.

Return user-facing Markdown. Keep private analyst notes, internal reasoning, and execution details
private.
"""


class FinalAnswerError(Exception):
    def __init__(self, code: str, public_message: str) -> None:
        self.code = code
        self.public_message = public_message
        super().__init__(public_message)


class FinalAnswerClientFactory(Protocol):
    def __call__(self, model: ModelRuntimeConfiguration, timeout_seconds: float) -> ModelClient: ...


def default_client_factory(model: ModelRuntimeConfiguration, timeout_seconds: float) -> ModelClient:
    return OpenAICompatibleClient(
        base_url=model.base_url,
        api_key=model.api_key,
        timeout_seconds=timeout_seconds,
    )


class FinalAnswerRuntime:
    def __init__(
        self,
        *,
        settings: Settings,
        client_factory: FinalAnswerClientFactory = default_client_factory,
    ) -> None:
        self.settings = settings
        self.client_factory = client_factory

    async def run(
        self,
        *,
        job_id: uuid.UUID,
        model: ModelRuntimeConfiguration,
        evidence: EvidenceBundle,
        default_instructions: str | None = None,
        command_instructions: str | None = None,
        command_name: str | None = None,
    ) -> str:
        context = render_evidence_context(evidence)
        await append_agent_event(
            job_id,
            "finalization.started",
            {"model_profile_id": model.profile_id},
        )
        prompt_sections = [FINALIZER_SYSTEM_PROMPT]
        if default_instructions and default_instructions.strip():
            prompt_sections.append(
                f"# Workspace Default Instructions\n\n{default_instructions.strip()}"
            )
        if command_instructions and command_instructions.strip():
            header = (
                f"# Command Instructions (/{command_name})"
                if command_name
                else "# Specialized Command Instructions"
            )
            prompt_sections.append(f"{header}\n\n{command_instructions.strip()}")
        finalizer_system_prompt = "\n\n".join(prompt_sections)

        markdown = await self._complete(
            job_id=job_id,
            model=model,
            messages=[
                ModelMessage(role="system", content=finalizer_system_prompt),
                ModelMessage(role="user", content=context),
            ],
        )
        markdown = normalize_final_answer(markdown)
        has_custom_instructions = bool(
            (default_instructions and default_instructions.strip())
            or (command_instructions and command_instructions.strip())
        )
        warnings = validate_final_answer(
            markdown, evidence, has_custom_instructions=has_custom_instructions
        )
        if warnings:
            await append_agent_event(
                job_id,
                "finalization.quality_warning",
                {"warnings": warnings},
                level="warning",
            )

        await append_agent_event(
            job_id,
            "finalization.completed",
            {"quality_warning_count": len(warnings)},
        )
        return markdown

    async def _complete(
        self,
        *,
        job_id: uuid.UUID,
        model: ModelRuntimeConfiguration,
        messages: list[ModelMessage],
    ) -> str:
        execution_id = await self._start_execution(job_id, model)
        client = self.client_factory(model, float(self.settings.final_answer_timeout_seconds))
        try:
            raw = await run_cancellable(
                job_id,
                client.chat_completion(
                    model=model.model_name,
                    messages=messages,
                    settings=model.settings,
                ),
                timeout_seconds=float(self.settings.final_answer_timeout_seconds),
            )
            completion = cast(ModelCompletion, raw)
            if not completion.text.strip():
                raise FinalAnswerError(
                    "FINAL_ANSWER_INVALID", "The final-answer model returned an empty response."
                )
        except AgentCancelledError:
            await self._finish_execution(
                execution_id,
                status="failed",
                error_code="JOB_CANCELLED",
                error_message="Finalization was cancelled.",
            )
            raise
        except TimeoutError as exc:
            await self._finish_execution(
                execution_id,
                status="failed",
                error_code="FINAL_ANSWER_TIMEOUT",
                error_message=f"The final-answer model timed out after {self.settings.final_answer_timeout_seconds} seconds.",
            )
            raise FinalAnswerError(
                "FINAL_ANSWER_TIMEOUT", "The final answer took too long to generate."
            ) from exc
        except ModelProviderError as exc:
            await self._finish_execution(
                execution_id,
                status="failed",
                error_code="FINAL_ANSWER_PROVIDER_FAILED",
                error_message=diagnostic_message(exc.public_message, exc.diagnostics),
            )
            raise FinalAnswerError(
                "FINAL_ANSWER_PROVIDER_FAILED",
                "The final-answer model could not complete the response.",
            ) from exc
        except FinalAnswerError as exc:
            await self._finish_execution(
                execution_id,
                status="failed",
                error_code=exc.code,
                error_message=exc.public_message,
            )
            raise
        except Exception as exc:
            await self._finish_execution(
                execution_id,
                status="failed",
                error_code="FINAL_ANSWER_PROVIDER_FAILED",
                error_message="The final-answer model failed unexpectedly.",
            )
            raise FinalAnswerError(
                "FINAL_ANSWER_PROVIDER_FAILED",
                "The final-answer model could not complete the response.",
            ) from exc

        usage = completion.usage
        await self._finish_execution(
            execution_id,
            status="succeeded",
            input_tokens=usage.input_tokens if usage else None,
            output_tokens=usage.output_tokens if usage else None,
            total_tokens=usage.total_tokens if usage else None,
        )
        return completion.text

    @staticmethod
    async def _start_execution(job_id: uuid.UUID, model: ModelRuntimeConfiguration) -> uuid.UUID:
        async with get_session_factory()() as session:
            repo = AgentExecutionRepository(session)
            item = ModelExecution(
                job_id=job_id,
                sequence=await repo.next_model_sequence(job_id),
                model_profile_id=uuid.UUID(model.profile_id),
                model_name=model.model_name,
                phase="finalization",
                status="started",
                started_at=utc_now(),
            )
            repo.add_model(item)
            await session.commit()
            return item.id

    @staticmethod
    async def _finish_execution(
        execution_id: uuid.UUID,
        *,
        status: str,
        error_code: str | None = None,
        error_message: str | None = None,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        total_tokens: int | None = None,
    ) -> None:
        async with get_session_factory()() as session:
            item = await session.get(ModelExecution, execution_id)
            if item is None:
                return
            item.status = status
            item.error_code = error_code
            item.error_message = error_message
            item.input_tokens = input_tokens
            item.output_tokens = output_tokens
            item.total_tokens = total_tokens
            item.finished_at = utc_now()
            await session.commit()
