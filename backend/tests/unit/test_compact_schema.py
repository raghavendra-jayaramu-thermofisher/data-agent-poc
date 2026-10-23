from types import SimpleNamespace

from app.data_sources.types import ColumnMetadata, ForeignKeyMetadata, TableMetadata
from app.knowledge.builder import build_table_document
from app.knowledge.compact import compact_schema, compact_table


def document(table: TableMetadata) -> SimpleNamespace:
    """A stored table document exactly as knowledge generation builds it."""
    built = build_table_document(table)
    return SimpleNamespace(
        document_type=built.document_type,
        document_key=built.document_key,
        content_markdown=built.content_markdown,
        metadata_json=built.metadata,
    )


ORDERS = TableMetadata(
    schema="dbo",
    name="Order Lines",
    object_type="table",
    columns=(
        ColumnMetadata("OrderId", "INT", False),
        ColumnMetadata("Customer Name", 'VARCHAR(50) COLLATE "SQL_Latin1_General_CP1_CI_AS"', True),
        ColumnMetadata("Amount|USD", "DECIMAL(18, 2)", None, default="0"),
        ColumnMetadata("CustomerId", "INT", True),
    ),
    primary_key=("OrderId",),
    foreign_keys=(ForeignKeyMetadata(("CustomerId",), "dbo", "Customers", ("Id",)),),
)


def test_a_table_becomes_one_line_with_types_keys_and_relationships():
    assert compact_table(document(ORDERS)) == (
        "dbo.[Order Lines] (table): OrderId INT NOT NULL, [Customer Name] VARCHAR(50), "
        "[Amount|USD] DECIMAL(18, 2), CustomerId INT; PK(OrderId); "
        "FK(CustomerId)->dbo.Customers(Id)"
    )


def test_views_and_objects_without_columns_or_schema_are_still_listed():
    view = TableMetadata(None, "Open Orders", "view", ())
    assert compact_table(document(view)) == "[Open Orders] (view): no columns reported"


def test_the_whole_schema_is_sorted_and_counts_only_table_documents():
    index = SimpleNamespace(document_type="index", document_key="index",
                            content_markdown="# index", metadata_json={})
    zeta = TableMetadata("dbo", "zeta", "table", (ColumnMetadata("id", "INT", False),))
    text, count = compact_schema("Warehouse", [document(zeta), index, document(ORDERS)])
    lines = text.splitlines()
    assert count == 2
    assert lines[0] == "-- Warehouse: 2 tables and views"
    assert lines[2].startswith("dbo.[Order Lines]") and lines[3].startswith("dbo.zeta")
    assert text.endswith("\n")
