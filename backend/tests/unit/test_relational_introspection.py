from unittest.mock import Mock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.engine.reflection import Inspector, ObjectKind

from app.data_sources.adapters.relational import SQLAlchemyAsyncAdapter


def test_batch_inspection_preserves_columns_keys_and_views() -> None:
    engine = create_engine("sqlite://")
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql(
                "CREATE TABLE accounts (id INTEGER, region TEXT, PRIMARY KEY (id, region))"
            )
            connection.exec_driver_sql(
                "CREATE TABLE orders (id INTEGER PRIMARY KEY, account_id INTEGER, region TEXT, "
                "amount INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (account_id, region) "
                "REFERENCES accounts (id, region))"
            )
            connection.exec_driver_sql("CREATE VIEW order_summary AS SELECT id, amount FROM orders")
            adapter = SQLAlchemyAsyncAdapter(URL.create("sqlite"))
            metadata = adapter._inspect_sync(connection)
        assert [(obj.name, obj.object_type) for obj in metadata.tables] == [
            ("accounts", "table"),
            ("orders", "table"),
            ("order_summary", "view"),
        ]
        accounts, orders, view = metadata.tables
        assert accounts.primary_key == ("id", "region")
        assert orders.primary_key == ("id",)
        amount = next(column for column in orders.columns if column.name == "amount")
        assert amount.native_type == "INTEGER"
        assert amount.nullable is False and amount.default == "0"
        assert orders.foreign_keys[0].constrained_columns == ("account_id", "region")
        assert orders.foreign_keys[0].referred_table == "accounts"
        assert orders.foreign_keys[0].referred_columns == ("id", "region")
        assert [column.name for column in view.columns] == ["id", "amount"]
        assert view.primary_key == () and view.foreign_keys == ()
        assert all(obj.schema is None for obj in metadata.tables)
    finally:
        engine.dispose()


def make_inspector(tables: list[str], views: list[str]) -> Mock:
    inspector = Mock(spec=Inspector)
    inspector.get_table_names.return_value = tables
    inspector.get_view_names.return_value = views
    inspector.get_multi_columns.return_value = {
        ("dbo", name): [{"name": "id", "type": "INTEGER", "nullable": False}]
        for name in tables + views
    }
    inspector.get_multi_pk_constraint.return_value = {
        ("dbo", name): {"constrained_columns": ["id"]} for name in tables
    }
    inspector.get_multi_foreign_keys.return_value = {("dbo", name): [] for name in tables}
    return inspector


def test_large_schema_uses_one_batch_per_metadata_category() -> None:
    inspector = make_inspector(
        [f"table_{index}" for index in range(175)],
        [f"view_{index}" for index in range(93)],
    )
    adapter = SQLAlchemyAsyncAdapter(URL.create("sqlite"), schema="dbo")
    with patch("app.data_sources.adapters.relational.inspect", return_value=inspector):
        metadata = adapter._inspect_sync(object())
    assert len(metadata.tables) == 268
    assert sum(obj.object_type == "view" for obj in metadata.tables) == 93
    inspector.get_multi_columns.assert_called_once_with(schema="dbo", kind=ObjectKind.ANY)
    inspector.get_multi_pk_constraint.assert_called_once_with(schema="dbo")
    inspector.get_multi_foreign_keys.assert_called_once_with(schema="dbo")
    inspector.get_columns.assert_not_called()
    inspector.get_pk_constraint.assert_not_called()
    inspector.get_foreign_keys.assert_not_called()


def test_optional_reflection_features_can_be_unsupported() -> None:
    inspector = make_inspector(["orders"], [])
    inspector.get_view_names.side_effect = NotImplementedError
    inspector.get_multi_pk_constraint.side_effect = NotImplementedError
    inspector.get_multi_foreign_keys.side_effect = NotImplementedError
    adapter = SQLAlchemyAsyncAdapter(URL.create("sqlite"), schema="dbo")
    with patch("app.data_sources.adapters.relational.inspect", return_value=inspector):
        metadata = adapter._inspect_sync(object())
    assert len(metadata.tables[0].columns) == 1
    assert metadata.tables[0].primary_key == ()
    assert metadata.tables[0].foreign_keys == ()


@pytest.mark.parametrize("views", [[], ["summary"]])
def test_empty_and_view_only_schemas_skip_table_constraints(views: list[str]) -> None:
    inspector = make_inspector([], views)
    adapter = SQLAlchemyAsyncAdapter(URL.create("sqlite"), schema="dbo")
    with patch("app.data_sources.adapters.relational.inspect", return_value=inspector):
        metadata = adapter._inspect_sync(object())
    assert len(metadata.tables) == len(views)
    inspector.get_multi_pk_constraint.assert_not_called()
    inspector.get_multi_foreign_keys.assert_not_called()
    if not views:
        inspector.get_multi_columns.assert_not_called()
