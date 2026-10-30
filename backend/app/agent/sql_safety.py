from __future__ import annotations

from dataclasses import dataclass


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

    return cleaned
