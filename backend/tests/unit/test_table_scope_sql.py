import pytest

from app.agent.sql_safety import SQLSafetyViolation, validate_read_only_sql


@pytest.mark.parametrize(
    "kind,schema", [("postgres", "public"), ("mysql", "app"), ("mssql", "dbo"), ("duckdb", "main")]
)
def test_selected_table_is_qualified_in_each_dialect(kind, schema):
    result = validate_read_only_sql(
        "SELECT * FROM orders",
        source_kind=kind,
        allowed_tables=((schema, "orders"),),
        catalog_tables=((schema, "orders"), (schema, "customers")),
    )
    assert schema in result
    assert "orders" in result


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM dbo.customers",
        "SELECT * FROM dbo.orders JOIN dbo.customers c ON 1=1",
        "SELECT * FROM dbo.orders WHERE EXISTS (SELECT 1 FROM dbo.customers)",
        "SELECT * FROM dbo.orders UNION ALL SELECT * FROM dbo.customers",
        "WITH allowed AS (SELECT * FROM dbo.customers) SELECT * FROM allowed",
        "WITH x AS (SELECT * FROM dbo.orders) SELECT * FROM x JOIN dbo.customers c ON 1=1",
        "SELECT * FROM another_database.dbo.orders",
        "SELECT * FROM OPENQUERY(remote_server, 'SELECT * FROM customers')",
    ],
)
def test_unselected_references_fail_before_execution(sql):
    with pytest.raises(SQLSafetyViolation):
        validate_read_only_sql(
            sql,
            source_kind="mssql",
            allowed_tables=(("dbo", "orders"),),
            catalog_tables=(("dbo", "orders"), ("dbo", "customers")),
        )


def test_cte_and_derived_query_aliases_are_not_treated_as_physical_tables():
    sql = "WITH x AS (SELECT * FROM dbo.orders) SELECT * FROM (SELECT * FROM x) y"
    assert validate_read_only_sql(sql, source_kind="mssql", allowed_tables=(("dbo", "orders"),))


def test_ambiguous_unqualified_table_does_not_use_selected_table_by_assumption():
    with pytest.raises(SQLSafetyViolation):
        validate_read_only_sql(
            "SELECT * FROM orders",
            source_kind="postgres",
            allowed_tables=(("public", "orders"),),
            catalog_tables=(("public", "orders"), ("private", "orders")),
        )


def test_quoted_postgres_case_and_dot_in_identifier_are_preserved():
    result = validate_read_only_sql(
        'SELECT * FROM "odd.schema"."Order.Items"',
        source_kind="postgres",
        allowed_tables=(("odd.schema", "Order.Items"),),
    )
    assert '"odd.schema"."Order.Items"' in result
    with pytest.raises(SQLSafetyViolation):
        validate_read_only_sql(
            "SELECT * FROM public.ORDERS",
            source_kind="postgres",
            allowed_tables=(("public", "Orders"),),
        )


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM read_csv('data.csv')",
        "SELECT * FROM read_parquet('data.parquet')",
        "SELECT * FROM UNNEST([1,2])",
    ],
)
def test_table_functions_cannot_bypass_selected_scope(sql):
    with pytest.raises(SQLSafetyViolation):
        validate_read_only_sql(sql, source_kind="duckdb", allowed_tables=(("main", "orders"),))


def test_empty_selected_scope_does_not_mean_all_tables():
    with pytest.raises(SQLSafetyViolation):
        validate_read_only_sql("SELECT * FROM orders", source_kind="postgres", allowed_tables=())


def test_all_tables_mode_retains_existing_behavior():
    assert (
        validate_read_only_sql("SELECT * FROM any_table", source_kind="postgres")
        == "SELECT * FROM any_table"
    )
