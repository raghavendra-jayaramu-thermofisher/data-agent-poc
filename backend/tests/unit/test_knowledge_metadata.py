from sqlalchemy import DateTime

from app.knowledge.models import KnowledgeAnnotation, KnowledgeBase, KnowledgeDocument, KnowledgeVersion


def test_all_knowledge_datetime_columns_are_timezone_aware() -> None:
    for model in (KnowledgeBase, KnowledgeVersion, KnowledgeDocument, KnowledgeAnnotation):
        for column in model.__table__.columns:
            if isinstance(column.type, DateTime):
                assert column.type.timezone is True, f"{model.__tablename__}.{column.name}"


def test_knowledge_models_have_expected_database_constraints() -> None:
    assert any(c.name == "uq_knowledge_bases_data_source" for c in KnowledgeBase.__table__.constraints)
    assert any(c.name == "uq_knowledge_versions_number" for c in KnowledgeVersion.__table__.constraints)
    assert any(c.name == "uq_knowledge_documents_key" for c in KnowledgeDocument.__table__.constraints)


def test_document_api_schema_reads_metadata_alias() -> None:
    import uuid
    from app.core.time import utc_now
    from app.knowledge.schemas import KnowledgeDocumentSummary

    document = KnowledgeDocument(
        id=uuid.uuid4(),
        knowledge_version_id=uuid.uuid4(),
        document_type="table_schema",
        document_key="public.orders",
        title="public.orders",
        content_markdown="# orders",
        metadata_json={"object_type": "table", "column_count": 2},
        estimated_tokens=4,
        created_at=utc_now(),
    )
    payload = KnowledgeDocumentSummary.model_validate(document)
    assert payload.metadata == {"object_type": "table", "column_count": 2}
