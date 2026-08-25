import pytest
from pydantic import ValidationError

from app.knowledge.schemas import KnowledgeAnnotationCreate


def test_datasource_annotation_can_omit_scope_key() -> None:
    item = KnowledgeAnnotationCreate(scope_type="datasource", content="  Trusted source  ")
    assert item.scope_key is None
    assert item.content == "Trusted source"


def test_table_column_metric_annotations_require_scope_key() -> None:
    for scope in ("table", "column", "metric"):
        with pytest.raises(ValidationError):
            KnowledgeAnnotationCreate(scope_type=scope, content="Definition")


def test_annotation_normalizes_scope_key() -> None:
    item = KnowledgeAnnotationCreate(scope_type="metric", scope_key=" revenue ", content="Captured payments")
    assert item.scope_key == "revenue"
