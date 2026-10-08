from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, NoReturn

if TYPE_CHECKING:
    from sqlglot import exp


@dataclass(frozen=True, slots=True)
class SQLSafetyViolation(Exception):
    code: str
    public_message: str

    def __str__(self) -> str:
        return self.public_message


_DIALECTS = {
    "postgres": "postgres",
    "mysql": "mysql",
    "mssql": "tsql",
    "duckdb": "duckdb",
}


def dialect_for_source(kind: str) -> str:
    dialect = _DIALECTS.get(kind)
    if dialect is None:
        raise SQLSafetyViolation(
            "SQL_DIALECT_UNSUPPORTED",
            "SQL validation is not available for this datasource type.",
        )
    return dialect


def validate_read_only_sql(
    sql: str,
    *,
    source_kind: str,
    allowed_tables: tuple[tuple[str | None, str], ...] | None = None,
    catalog_tables: tuple[tuple[str | None, str], ...] | None = None,
) -> str:
    """Parse and validate one read-only analytical SQL statement.

    Production uses sqlglot as a real SQL parser. There is intentionally no regex
    fallback: if the parser dependency is unavailable, execution fails closed.
    """

    cleaned = sql.strip()
    if not cleaned:
        raise SQLSafetyViolation("SQL_EMPTY", "SQL cannot be empty.")
    if len(cleaned) > 100_000:
        raise SQLSafetyViolation("SQL_TOO_LARGE", "SQL exceeds the allowed statement size.")

    try:
        import sqlglot
        from sqlglot import exp
        from sqlglot.errors import ParseError
    except ImportError as exc:  # pragma: no cover - production packaging failure path
        raise SQLSafetyViolation(
            "SQL_VALIDATOR_UNAVAILABLE",
            "SQL validation is unavailable on this server.",
        ) from exc

    try:
        statements = sqlglot.parse(cleaned, read=dialect_for_source(source_kind))
    except ParseError as exc:
        raise SQLSafetyViolation(
            "SQL_PARSE_FAILED", "The generated SQL could not be parsed."
        ) from exc
    except Exception as exc:
        raise SQLSafetyViolation(
            "SQL_PARSE_FAILED", "The generated SQL could not be parsed."
        ) from exc

    statements = [statement for statement in statements if statement is not None]
    if len(statements) != 1:
        raise SQLSafetyViolation(
            "SQL_MULTIPLE_STATEMENTS",
            "Only one SQL statement may be executed at a time.",
        )

    statement = statements[0]
    query_type = getattr(exp, "Query", None)
    if query_type is None or not isinstance(statement, query_type):
        raise SQLSafetyViolation(
            "SQL_NOT_READ_ONLY",
            "Only read-only analytical SELECT queries are allowed.",
        )

    forbidden_names = (
        "Insert",
        "Update",
        "Delete",
        "Create",
        "Drop",
        "Alter",
        "Merge",
        "Command",
        "Transaction",
        "Commit",
        "Rollback",
        "Grant",
        "Revoke",
        "Copy",
        "LoadData",
        "Into",
        "Lock",
        "Use",
        "Set",
        "Pragma",
        "Attach",
        "Detach",
    )
    forbidden_types = tuple(
        value for name in forbidden_names if (value := getattr(exp, name, None)) is not None
    )
    if forbidden_types:
        for node in statement.walk():
            if isinstance(node, forbidden_types):
                raise SQLSafetyViolation(
                    "SQL_NOT_READ_ONLY",
                    "Only read-only analytical SELECT queries are allowed.",
                )

    if allowed_tables is not None:
        _validate_table_scope(
            statement, source_kind, allowed_tables, catalog_tables or allowed_tables
        )
        # Qualify physical references so a different default schema/search path cannot
        # resolve an unqualified name to an unselected object.
        return statement.sql(dialect=dialect_for_source(source_kind))
    return cleaned


def _validate_table_scope(
    statement: exp.Expression,
    source_kind: str,
    allowed_tables: tuple[tuple[str | None, str], ...],
    catalog_tables: tuple[tuple[str | None, str], ...],
) -> None:
    from sqlglot import exp
    from sqlglot.optimizer.scope import Scope, traverse_scope

    def reject(message: str) -> NoReturn:
        raise SQLSafetyViolation("SQL_TABLE_NOT_AUTHORIZED", message)

    def matches(identifier: exp.Expression | None, value: str | None) -> bool:
        if value is None or not isinstance(identifier, exp.Identifier):
            return False
        if source_kind == "postgres":
            return value == (
                identifier.name if identifier.args.get("quoted") else identifier.name.lower()
            )
        # Conservative across server collations: multiple folded matches are rejected.
        return identifier.name.casefold() == value.casefold()

    try:
        scopes = list(traverse_scope(statement))
        if not scopes:
            reject("Cannot resolve this query within the selected table scope.")
        for scope in scopes:
            if getattr(scope, "is_udtf", False):
                reject("Table functions are unavailable when specific tables are selected.")
            for _, (_, source) in scope.selected_sources.items():
                if isinstance(source, Scope):
                    continue  # Derived query / CTE: its physical sources have their own scope.
                if not isinstance(source, exp.Table) or not isinstance(source.this, exp.Identifier):
                    reject("Only selected database tables and views may be queried.")
                if source.args.get("catalog"):
                    reject("Cross-database references are unavailable in selected tables mode.")
                candidates = [
                    item
                    for item in catalog_tables
                    if matches(source.this, item[1])
                    and (not source.args.get("db") or matches(source.args["db"], item[0]))
                ]
                if len(candidates) != 1 or candidates[0] not in allowed_tables:
                    reject(
                        f"Table {source.sql()} is outside the selection or ambiguous. "
                        "Use a selected schema-qualified table."
                    )
                schema, name = candidates[0]
                source.set("this", exp.to_identifier(name, quoted=True))
                if schema:
                    source.set("db", exp.to_identifier(schema, quoted=True))
    except SQLSafetyViolation:
        raise
    except Exception as exc:
        raise SQLSafetyViolation(
            "SQL_TABLE_SCOPE_UNRESOLVED", "Cannot safely resolve this query's table references."
        ) from exc
