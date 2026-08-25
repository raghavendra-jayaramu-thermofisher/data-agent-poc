from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ReadKnowledgeIndexArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    data_source_id: uuid.UUID


class ReadTableSchemaArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    data_source_id: uuid.UUID
    table_key: str = Field(min_length=1, max_length=600)


class ExecuteSQLArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    data_source_id: uuid.UUID
    sql: str = Field(min_length=1, max_length=100_000)


class ChartSeriesInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    field: str = Field(min_length=1, max_length=255)
    label: str | None = Field(default=None, max_length=160)


class CreateChartArgs(BaseModel):
    """Frontend-only chart description grounded in a persisted SQL execution."""

    model_config = ConfigDict(extra="forbid")

    sql_execution_id: uuid.UUID
    chart_type: Literal["bar", "line", "area", "pie", "metric"]
    title: str = Field(min_length=1, max_length=240)
    x_field: str | None = Field(default=None, max_length=255)
    x_label: str | None = Field(default=None, max_length=160)
    series: list[ChartSeriesInput] = Field(default_factory=list, max_length=8)
    category_field: str | None = Field(default=None, max_length=255)
    value_field: str | None = Field(default=None, max_length=255)
    value_label: str | None = Field(default=None, max_length=160)

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
