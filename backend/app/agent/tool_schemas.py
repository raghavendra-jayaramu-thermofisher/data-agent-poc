from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ReadKnowledgeIndexArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    data_source_id: uuid.UUID = Field(
        description="Exact authorized datasource ID supplied in the conversation context."
    )


class ReadTableSchemaArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    data_source_id: uuid.UUID = Field(
        description="Exact authorized datasource ID previously used with read_knowledge_index."
    )
    table_key: str = Field(
        min_length=1,
        max_length=600,
        description=(
            "Exact schema document key returned by read_knowledge_index, including its schema "
            "prefix and original spelling when present. Do not invent or shorten this key."
        ),
    )


class ExecuteSQLArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    data_source_id: uuid.UUID = Field(
        description="Exact authorized datasource ID whose knowledge and table schemas were inspected."
    )
    sql: str = Field(
        min_length=1,
        max_length=100_000,
        description=(
            "One read-only analytical statement in the datasource's native SQL dialect. Use only "
            "verified table and column names. Perform filtering, joins, aggregation, and ordering "
            "in SQL; never send mutations or multiple statements."
        ),
    )
    title: str | None = Field(
        default=None,
        max_length=240,
        description=(
            "Short business-facing title for the persisted result table, describing what the rows "
            "represent rather than how the SQL works."
        ),
    )
    display: Literal["expanded", "collapsed", "hidden", "auto"] = Field(
        default="auto",
        description=(
            "Who presents this result: 'expanded' makes the UI table the primary answer, "
            "'collapsed' keeps a supporting UI table available, 'hidden' suppresses the UI "
            "table for internal work or a result that will be shown once inline, and 'auto' "
            "lets the UI choose. "
            "Never repeat a visible result as a Markdown table."
        ),
    )
    column_labels: dict[str, str] | None = Field(
        default=None,
        description=(
            "Optional mapping from exact output column names or aliases to business-friendly UI "
            "labels. This changes presentation only, not SQL values."
        ),
    )


class ChartSeriesInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    field: str = Field(
        min_length=1,
        max_length=255,
        description="Exact numeric output column from the referenced successful SQL result.",
    )
    label: str | None = Field(
        default=None,
        max_length=160,
        description="Optional business-friendly legend label for this numeric series.",
    )


class CreateChartArgs(BaseModel):
    """Frontend-only chart description grounded in a persisted SQL execution."""

    model_config = ConfigDict(extra="forbid")

    sql_execution_id: uuid.UUID = Field(
        description=(
            "Exact sql_execution_id returned by a successful execute_sql call in this same job."
        )
    )
    chart_type: Literal["bar", "line", "area", "pie", "metric"] = Field(
        description=(
            "Presentation type: metric for one headline value, line or area for ordered trends, "
            "bar for category comparisons, and pie only for a small part-to-whole breakdown."
        )
    )
    title: str = Field(
        min_length=1,
        max_length=240,
        description="Concise business-facing statement of what the visualization shows.",
    )
    x_field: str | None = Field(
        default=None,
        max_length=255,
        description=(
            "Exact category or ordered-time output column for bar, line, or area charts; omit for "
            "pie and metric presentations."
        ),
    )
    x_label: str | None = Field(
        default=None,
        max_length=160,
        description="Optional business-friendly axis label for x_field.",
    )
    series: list[ChartSeriesInput] = Field(
        default_factory=list,
        max_length=8,
        description=(
            "One or more numeric output columns for bar, line, or area charts; omit for pie and "
            "metric presentations."
        ),
    )
    category_field: str | None = Field(
        default=None,
        max_length=255,
        description="Exact category output column for a pie chart; omit for all other chart types.",
    )
    value_field: str | None = Field(
        default=None,
        max_length=255,
        description=(
            "Exact numeric output column for a pie chart or metric card; omit for bar, line, and "
            "area charts."
        ),
    )
    value_label: str | None = Field(
        default=None,
        max_length=160,
        description="Optional business-friendly label for value_field.",
    )

    @model_validator(mode="after")
    def validate_shape(self) -> "CreateChartArgs":
        if self.chart_type == "pie":
            if not self.category_field or not self.value_field:
                raise ValueError("pie charts require category_field and value_field")
            if self.x_field is not None or self.series:
                raise ValueError("pie charts must not define x_field or series")
        elif self.chart_type == "metric":
            if not self.value_field:
                raise ValueError("metric cards require value_field")
            if self.x_field is not None or self.series or self.category_field is not None:
                raise ValueError("metric cards must not define x_field, series, or category_field")
        else:
            if not self.x_field:
                raise ValueError(f"{self.chart_type} charts require x_field")
            if not self.series:
                raise ValueError(f"{self.chart_type} charts require at least one series")
            if self.category_field is not None or self.value_field is not None:
                raise ValueError("non-pie charts must not define category_field/value_field")
        return self
