from app.data_sources.types import ColumnMetadata, ForeignKeyMetadata, SchemaMetadata, TableMetadata
from app.knowledge.builder import build_snapshot, build_table_document, qualified_table_key, schema_fingerprint


def sample_schema() -> SchemaMetadata:
    return SchemaMetadata(
        tables=(
            TableMetadata(
                schema="public",
                name="orders",
                object_type="table",
                columns=(
                    ColumnMetadata("id", "INTEGER", False),
                    ColumnMetadata("customer_id", "INTEGER", False),
                    ColumnMetadata("total", "NUMERIC(12,2)", False),
                ),
                primary_key=("id",),
                foreign_keys=(
                    ForeignKeyMetadata(("customer_id",), "public", "customers", ("id",)),
                ),
            ),
            TableMetadata(
                schema="public",
                name="customers",
                object_type="table",
                columns=(
                    ColumnMetadata("id", "INTEGER", False),
                    ColumnMetadata("name", "VARCHAR", True),
                ),
                primary_key=("id",),
            ),
        )
    )


def test_snapshot_is_deterministic_and_compact_index() -> None:
    first = build_snapshot(sample_schema())
    second = build_snapshot(SchemaMetadata(tables=tuple(reversed(sample_schema().tables))))
    assert first.schema_fingerprint == second.schema_fingerprint
    assert first.index.content_markdown == second.index.content_markdown
    assert len(first.tables) == 2
    assert "public.orders" in first.index.content_markdown
    assert "NUMERIC(12,2)" not in first.index.content_markdown
    assert first.index.estimated_tokens > 0


def test_fingerprint_changes_for_schema_change() -> None:
    original = sample_schema()
    changed = SchemaMetadata(
        tables=original.tables
        + (
            TableMetadata(
                schema="public",
                name="payments",
                object_type="table",
                columns=(ColumnMetadata("id", "BIGINT", False),),
            ),
        )
    )
    assert schema_fingerprint(original) != schema_fingerprint(changed)


def test_table_document_contains_deterministic_structure_and_relationships() -> None:
    document = build_table_document(sample_schema().tables[0])
    assert document.document_type == "table_schema"
    assert document.document_key == "public.orders"
    assert "`customer_id`" in document.content_markdown
    assert "`public.customers(id)`" in document.content_markdown
    assert document.metadata["column_count"] == 3
    assert document.metadata["foreign_key_count"] == 1


def test_empty_database_produces_valid_index() -> None:
    snapshot = build_snapshot(SchemaMetadata(tables=()))
    assert snapshot.tables == ()
    assert "No user tables or views were found." in snapshot.index.content_markdown
    assert len(snapshot.schema_fingerprint) == 64


def test_unusual_identifier_is_preserved_exactly() -> None:
    table = TableMetadata(
        schema="Sales Data",
        name="Order Items-2026",
        object_type="table",
        columns=(ColumnMetadata("Unit Price ($)", "DECIMAL", True),),
    )
    assert qualified_table_key(table) == "Sales Data.Order Items-2026"
    document = build_table_document(table)
    assert "Sales Data.Order Items-2026" in document.content_markdown
    assert "Unit Price ($)" in document.content_markdown


def test_large_table_count_builds_one_index_and_separate_documents() -> None:
    tables = tuple(
        TableMetadata(
            schema="public",
            name=f"table_{index:04d}",
            object_type="table",
            columns=(ColumnMetadata("id", "INTEGER", False),),
        )
        for index in range(1000)
    )
    snapshot = build_snapshot(SchemaMetadata(tables=tables))
    assert len(snapshot.tables) == 1000
    assert snapshot.index.metadata["object_count"] == 1000
    # The architecture keeps detailed column descriptions out of the initial index.
    assert "## Columns" not in snapshot.index.content_markdown
