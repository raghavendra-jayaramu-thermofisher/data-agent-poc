from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


WidgetType = Literal["metric", "table", "bar", "line", "area", "pie"]


class DashboardCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=4000)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title is required")
        return value


class DashboardUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, max_length=240)
    description: str | None = Field(default=None, max_length=4000)


class DashboardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    organization_id: uuid.UUID
    title: str
    description: str | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    widget_count: int = 0


class DashboardWidgetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_job_id: uuid.UUID
    source_sql_execution_id: uuid.UUID
    widget_type: WidgetType
    title: str | None = Field(default=None, max_length=240)
    visualization_config: dict[str, object] = Field(default_factory=dict)
    layout_config: dict[str, object] = Field(default_factory=dict)


class DashboardWidgetUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, max_length=240)
    visualization_config: dict[str, object] | None = None
    layout_config: dict[str, object] | None = None
    enabled: bool | None = None


class DashboardWidgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    dashboard_id: uuid.UUID
    data_source_id: uuid.UUID
    title: str
    widget_type: str
    question: str | None
    sql_text: str
    visualization_config: dict[str, object]
    layout_config: dict[str, object]
    created_from_job_id: uuid.UUID | None
    created_from_sql_execution_id: uuid.UUID | None
    last_refresh_job_id: uuid.UUID | None
    last_refreshed_at: datetime | None
    enabled: bool
    created_at: datetime
    updated_at: datetime
    latest_artifact: dict[str, object] | None = None


class DashboardDetailResponse(DashboardResponse):
    widgets: list[DashboardWidgetResponse] = Field(default_factory=list)


class DashboardRefreshResponse(BaseModel):
    job_id: uuid.UUID
