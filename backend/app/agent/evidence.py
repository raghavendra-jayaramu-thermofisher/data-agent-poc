from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass, replace

import sqlglot
from sqlalchemy.ext.asyncio import AsyncSession
from sqlglot import expressions as exp

from app.agent.models import JobArtifact, SQLExecution
from app.agent.repository import AgentExecutionRepository


@dataclass(frozen=True, slots=True)
class SQLResultEvidence:
    execution_id: uuid.UUID
    tool_sequence: int
    data_source_id: uuid.UUID
    sql_text: str
    columns: tuple[str, ...]
    rows: tuple[tuple[object, ...], ...]
    stored_row_count: int
    preview_row_count: int
    preview_truncated: bool
    stored_result_truncated: bool
    is_aggregate: bool
    table_artifact_id: uuid.UUID | None
    title: str
    display: str


@dataclass(frozen=True, slots=True)
class ArtifactEvidence:
    artifact_id: uuid.UUID
    kind: str
    title: str
    source_sql_execution_id: uuid.UUID | None
    payload: dict[str, object]
    valid: bool
    visible: bool = False


@dataclass(frozen=True, slots=True)
class EvidenceBundle:
    job_id: uuid.UUID
    question: str
    analyst_notes: str
    sql_results: tuple[SQLResultEvidence, ...]
    artifacts: tuple[ArtifactEvidence, ...]
    unavailable_information: bool

    @property
    def visible_artifacts(self) -> tuple[ArtifactEvidence, ...]:
        return tuple(item for item in self.artifacts if item.visible)


def is_aggregate_sql(sql: str) -> bool:
    try:
        statement = sqlglot.parse_one(sql)
    except sqlglot.errors.ParseError:
        return False
    return statement.find(exp.AggFunc) is not None or statement.find(exp.Group) is not None


def notes_report_unavailable(notes: str) -> bool:
    match = re.search(r"(?ims)^##\s+Unavailable information\s*$\s*(.*?)(?=^##\s+|\Z)", notes)
    if match is None:
        return False
    body = re.sub(r"[`*_]", "", match.group(1)).strip().strip(".- ").casefold()
    return body not in {"", "none", "not applicable", "n/a", "nothing"}


def _payload_rows(payload: dict[str, object]) -> tuple[tuple[object, ...], ...]:
    raw = payload.get("rows")
    if not isinstance(raw, list):
        return ()
    return tuple(tuple(row) for row in raw if isinstance(row, list))


def _payload_columns(payload: dict[str, object]) -> tuple[str, ...]:
    raw = payload.get("columns")
    if not isinstance(raw, list) or not all(isinstance(item, str) for item in raw):
        return ()
    return tuple(raw)


def _valid_table_artifact(payload: dict[str, object], source: SQLExecution | None) -> bool:
    columns = _payload_columns(payload)
    rows = _payload_rows(payload)
    return bool(
        source is not None
        and payload.get("schema_version") == 1
        and columns
        and isinstance(payload.get("rows"), list)
        and payload.get("row_count") == len(rows)
        and source.row_count == len(rows)
        and columns == tuple(source.columns or ())
        and payload.get("data_source_id") == str(source.data_source_id)
        and (payload.get("truncated") is True) == source.truncated
    )


def _valid_chart_artifact(payload: dict[str, object], source: SQLExecution | None) -> bool:
    if (
        source is None
        or payload.get("schema_version") != 1
        or payload.get("renderer") != "frontend"
        or payload.get("source_sql_execution_id") != str(source.id)
    ):
        return False
    chart_type = payload.get("chart_type")
    if chart_type not in {"bar", "line", "area", "pie", "metric"}:
        return False
    data = payload.get("data")
    encoding = payload.get("encoding")
    if not isinstance(data, list) or not all(isinstance(item, dict) for item in data):
        return False
    if not isinstance(encoding, dict):
        return False

    def encoded_field(value: object) -> str | None:
        if not isinstance(value, dict):
            return None
        field = value.get("field")
        return field if isinstance(field, str) and field else None

    fields: list[str]
    if chart_type == "pie":
        category = encoded_field(encoding.get("category"))
        value = encoded_field(encoding.get("value"))
        if category is None or value is None:
            return False
        fields = [category, value]
    elif chart_type == "metric":
        value = encoded_field(encoding.get("value"))
        if value is None:
            return False
        fields = [value]
    else:
        x_field = encoded_field(encoding.get("x"))
        series = encoding.get("series")
        if x_field is None or not isinstance(series, list) or not series:
            return False
        series_fields = [encoded_field(item) for item in series]
        if any(field is None for field in series_fields):
            return False
        fields = [x_field, *(field for field in series_fields if field is not None)]
    source_columns = set(source.columns or ())
    return all(field in source_columns for field in fields) and all(
        all(field in row for field in fields) for row in data
    )


async def collect_evidence(
    session: AsyncSession,
    *,
    job_id: uuid.UUID,
    question: str,
    analyst_notes: str,
) -> EvidenceBundle:
    repo = AgentExecutionRepository(session)
    tools = await repo.list_tools(job_id)
    sql_items = await repo.list_sql(job_id)
    artifact_items = await repo.list_artifacts(job_id)
    tool_sequence = {item.id: item.sequence for item in tools}
    tables_by_sql: dict[uuid.UUID, JobArtifact] = {}
    for artifact in artifact_items:
        if artifact.kind == "table" and artifact.source_sql_execution_id is not None:
            tables_by_sql.setdefault(artifact.source_sql_execution_id, artifact)

    successful_sql = {item.id: item for item in sql_items if item.status == "succeeded"}
    successful_ids = set(successful_sql)
    sql_results: list[SQLResultEvidence] = []
    for sql_item in sql_items:
        if sql_item.status != "succeeded":
            continue
        table = tables_by_sql.get(sql_item.id)
        payload = table.payload if table is not None and isinstance(table.payload, dict) else {}
        rows = _payload_rows(payload)
        columns = tuple(sql_item.columns or ()) or _payload_columns(payload)
        stored_count = sql_item.row_count if sql_item.row_count is not None else len(rows)
        raw_preview_count = payload.get("model_preview_row_count")
        preview_count = (
            raw_preview_count
            if isinstance(raw_preview_count, int) and raw_preview_count >= 0
            else stored_count
        )
        preview_truncated = bool(
            sql_item.truncated or payload.get("model_preview_truncated") is True
        )
        display = str(payload.get("display") or "auto")
        sql_results.append(
            SQLResultEvidence(
                execution_id=sql_item.id,
                tool_sequence=tool_sequence.get(sql_item.tool_execution_id, 0),
                data_source_id=sql_item.data_source_id,
                sql_text=sql_item.sql_text,
                columns=columns,
                rows=rows,
                stored_row_count=stored_count,
                preview_row_count=preview_count,
                preview_truncated=preview_truncated,
                stored_result_truncated=sql_item.truncated,
                is_aggregate=is_aggregate_sql(sql_item.sql_text),
                table_artifact_id=table.id if table is not None else None,
                title=(table.name or "Query result") if table is not None else "Query result",
                display=display,
            )
        )

    artifacts: list[ArtifactEvidence] = []
    for artifact_item in artifact_items:
        payload = artifact_item.payload if isinstance(artifact_item.payload, dict) else {}
        source_ok = (
            artifact_item.source_sql_execution_id is None
            or artifact_item.source_sql_execution_id in successful_ids
        )
        source = (
            successful_sql.get(artifact_item.source_sql_execution_id)
            if artifact_item.source_sql_execution_id is not None
            else None
        )
        if artifact_item.kind == "table":
            valid = source_ok and _valid_table_artifact(payload, source)
        elif artifact_item.kind == "chart":
            valid = source_ok and _valid_chart_artifact(payload, source)
        elif artifact_item.kind == "html":
            valid = bool(
                source_ok
                and payload.get("schema_version") == 1
                and payload.get("file_name") == "index.html"
                and isinstance(payload.get("size_bytes"), int)
                and int(payload["size_bytes"]) > 0
            )
        else:
            valid = artifact_item.kind == "text"
        artifacts.append(
            ArtifactEvidence(
                artifact_id=artifact_item.id,
                kind=artifact_item.kind,
                title=artifact_item.name or "Output",
                source_sql_execution_id=artifact_item.source_sql_execution_id,
                payload=payload,
                valid=valid,
            )
        )

    visible_artifacts = mark_visible_artifacts(artifacts)

    return EvidenceBundle(
        job_id=job_id,
        question=question,
        analyst_notes=analyst_notes,
        sql_results=tuple(sql_results),
        artifacts=visible_artifacts,
        unavailable_information=notes_report_unavailable(analyst_notes),
    )


def mark_visible_artifacts(
    artifacts: list[ArtifactEvidence] | tuple[ArtifactEvidence, ...],
) -> tuple[ArtifactEvidence, ...]:
    has_chart = any(item.kind == "chart" and item.valid for item in artifacts)
    has_nonempty_table = any(_is_nonempty_table(item) for item in artifacts)
    visible_artifacts: list[ArtifactEvidence] = []
    seen_renderables: set[str] = set()
    for artifact_evidence in artifacts:
        visible = False
        if artifact_evidence.valid and artifact_evidence.kind == "chart":
            signature = _renderable_signature(artifact_evidence)
            if signature not in seen_renderables:
                seen_renderables.add(signature)
                visible = True
        elif artifact_evidence.valid and artifact_evidence.kind == "html":
            visible = True
        elif artifact_evidence.valid and artifact_evidence.kind == "table":
            display = str(artifact_evidence.payload.get("display") or "auto")
            row_count = artifact_evidence.payload.get("row_count")
            exploratory_empty = (
                display == "auto" and row_count == 0 and (has_chart or has_nonempty_table)
            )
            if display != "hidden" and not exploratory_empty:
                signature = _renderable_signature(artifact_evidence)
                if signature not in seen_renderables:
                    seen_renderables.add(signature)
                    visible = True
        visible_artifacts.append(replace(artifact_evidence, visible=visible))
    return tuple(visible_artifacts)


def _renderable_signature(item: ArtifactEvidence) -> str:
    payload = {
        key: value
        for key, value in item.payload.items()
        if key != "source_sql_execution_id"
    }
    return json.dumps(
        {"kind": item.kind, "title": item.title, "payload": payload},
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )


def _is_nonempty_table(item: ArtifactEvidence) -> bool:
    row_count = item.payload.get("row_count")
    return item.kind == "table" and item.valid and isinstance(row_count, int) and row_count > 0


def validate_evidence(bundle: EvidenceBundle) -> list[str]:
    issues: list[str] = []
    if not bundle.sql_results and not bundle.unavailable_information:
        issues.append(
            "No successful analytical SQL supports the answer, and the notes do not establish "
            "that the requested information is unavailable."
        )

    for artifact in bundle.artifacts:
        if artifact.kind != "text" and not artifact.valid:
            issues.append(
                f"Artifact {artifact.artifact_id} ({artifact.kind}) is not grounded in a valid "
                "successful execution from this job."
            )

    aggregates = [
        item
        for item in bundle.sql_results
        if item.is_aggregate and not item.preview_truncated and not item.stored_result_truncated
    ]
    for detail in bundle.sql_results:
        if detail.is_aggregate or not detail.preview_truncated:
            continue
        if not any(item.tool_sequence > detail.tool_sequence for item in aggregates):
            issues.append(
                f"Detailed SQL execution {detail.execution_id} was only partially visible to the "
                "analysis model and has no later complete aggregate query supporting "
                "population-wide conclusions."
            )
    return issues


def build_evidence_correction(issues: list[str]) -> str:
    bullets = "\n".join(f"- {item}" for item in issues)
    return (
        "The analysis is not ready for finalization. Correct the evidence gaps below using the "
        "existing conversation and tool results. Execute only the additional aggregate or "
        "validation queries required; do not repeat an existing detail query. Then return a "
        "complete updated internal analysis handoff.\n\n"
        f"{bullets}"
    )


def _render_rows(item: SQLResultEvidence, *, limit: int) -> list[str]:
    lines = [" | ".join(item.columns)] if item.columns else []
    for row in item.rows[:limit]:
        lines.append(" | ".join("NULL" if value is None else str(value) for value in row))
    return lines


def render_evidence_context(bundle: EvidenceBundle) -> str:
    sections = [
        "ORIGINAL USER REQUEST\n" + bundle.question.strip(),
        "INTERNAL ANALYST NOTES\n" + bundle.analyst_notes.strip(),
    ]
    sql_blocks: list[str] = []
    for sql_result in bundle.sql_results:
        lines = [
            f"SQL EVIDENCE: {sql_result.title}",
            f"Execution ID: {sql_result.execution_id}",
            f"Datasource ID: {sql_result.data_source_id}",
            f"Evidence kind: {'aggregate' if sql_result.is_aggregate else 'detail'}",
            f"Stored rows: {sql_result.stored_row_count}",
            f"Model preview rows: {sql_result.preview_row_count}",
            f"Preview truncated: {'Yes' if sql_result.preview_truncated else 'No'}",
            f"Stored result truncated: {'Yes' if sql_result.stored_result_truncated else 'No'}",
            f"Columns: {', '.join(sql_result.columns) if sql_result.columns else 'Unavailable'}",
            f"SQL: {sql_result.sql_text}",
        ]
        row_limit = 200 if sql_result.is_aggregate else 50
        if not sql_result.preview_truncated and len(sql_result.rows) <= row_limit:
            rendered = _render_rows(sql_result, limit=row_limit)
            if rendered:
                lines.extend(["Complete rows:", *rendered])
        else:
            lines.append(
                "Rows omitted from finalizer context; use the visible artifact for detail."
            )
        sql_blocks.append("\n".join(lines))
    sections.append("VERIFIED SQL EVIDENCE\n" + ("\n\n".join(sql_blocks) or "None."))

    artifact_blocks = []
    for artifact in bundle.visible_artifacts:
        artifact_blocks.append(
            "\n".join(
                [
                    "ARTIFACT",
                    f"ID: {artifact.artifact_id}",
                    f"Type: {artifact.kind}",
                    f"Title: {artifact.title}",
                    "Source SQL: "
                    + (
                        str(artifact.source_sql_execution_id)
                        if artifact.source_sql_execution_id
                        else "None"
                    ),
                ]
            )
        )
    sections.append("AVAILABLE ARTIFACT MANIFEST\n" + ("\n\n".join(artifact_blocks) or "None."))
    sections.append(
        "VERIFIED AVAILABILITY STATUS\n"
        + (
            "The analyst established that at least one requested part is unavailable."
            if bundle.unavailable_information
            else "The analyst did not establish any unavailable requested information."
        )
    )
    return "\n\n---\n\n".join(sections)
