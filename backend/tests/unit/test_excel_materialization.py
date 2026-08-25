from __future__ import annotations

from datetime import date, datetime

from app.data_sources.excel import (
    classify_value,
    duckdb_type,
    merge_types,
    normalize_identifier,
    unique_identifiers,
)


def test_excel_identifier_normalization_is_deterministic() -> None:
    assert normalize_identifier("Order Items", prefix="sheet") == "order_items"
    assert normalize_identifier("123 Sales", prefix="sheet") == "sheet_123_sales"
    assert unique_identifiers(["Total", "Total", None], prefix="column") == [
        "total",
        "total_2",
        "column_3",
    ]


def test_excel_mixed_type_inference_prefers_preservation() -> None:
    assert merge_types("integer", "double") == "double"
    assert merge_types("integer", "text") == "text"
    assert merge_types("date", "timestamp") == "timestamp"
    assert duckdb_type(merge_types("integer", "text")) == "VARCHAR"


def test_excel_value_classification_keeps_native_types() -> None:
    assert classify_value(True) == "boolean"
    assert classify_value(3) == "integer"
    assert classify_value(3.4) == "double"
    assert classify_value(date(2026, 8, 24)) == "date"
    assert classify_value(datetime(2026, 8, 24, 12, 30)) == "timestamp"
    assert classify_value("unknown") == "text"
