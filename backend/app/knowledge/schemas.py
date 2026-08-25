from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class KnowledgeStatusResponse(BaseModel):
    data_source_id: uuid.UUID
    knowledge_base_id: uuid.UUID | None
    status: str
    current_version_id: uuid.UUID | None
    current_version_number: int | None
    schema_fingerprint: str | None
    generated_at: datetime | None
    object_count: int | None
    last_error_code: str | None


class KnowledgeVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    knowledge_base_id: uuid.UUID
    version_number: int
    schema_fingerprint: str
    generated_by_job_id: uuid.UUID | None
    created_at: datetime


class KnowledgeDocumentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_type: str
    document_key: str
    title: str
    metadata: dict[str, object] = Field(validation_alias="metadata_json")
    estimated_tokens: int
    created_at: datetime


class KnowledgeDocumentResponse(KnowledgeDocumentSummary):
    content_markdown: str


class KnowledgeAnnotationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scope_type: Literal["datasource", "table", "column", "metric"]
    scope_key: str | None = Field(default=None, max_length=600)
    content: str = Field(min_length=1, max_length=20000)

    @model_validator(mode="after")
    def validate_scope(self) -> "KnowledgeAnnotationCreate":
        if self.scope_type == "datasource":
            self.scope_key = self.scope_key.strip() if self.scope_key else None
        elif not self.scope_key or not self.scope_key.strip():
            raise ValueError("scope_key is required for table, column and metric annotations")
        else:
            self.scope_key = self.scope_key.strip()
        self.content = self.content.strip()
        return self


class KnowledgeAnnotationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(min_length=1, max_length=20000)


class KnowledgeAnnotationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    knowledge_base_id: uuid.UUID
    scope_type: str
    scope_key: str | None
    content: str
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class KnowledgeJobResponse(BaseModel):
    job_id: uuid.UUID
    knowledge_base_id: uuid.UUID
