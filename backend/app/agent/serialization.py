from __future__ import annotations

import base64
import json
import math
import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from app.data_sources.types import QueryResult


def json_safe(value: object) -> object:
    if value is None or isinstance(value, (str, int, bool)):
        return value
    if isinstance(value, float):
        if math.isfinite(value):
            return value
        if math.isnan(value):
            return "NaN"
        return "Infinity" if value > 0 else "-Infinity"
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"$binary_base64": base64.b64encode(bytes(value)).decode("ascii")}
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    return str(value)


def bound_query_result(
    result: QueryResult,
    *,
    max_bytes: int,
) -> tuple[list[str], list[list[object]], bool, int]:
    columns = list(result.columns)
    rows: list[list[object]] = []
    total_bytes = len(json.dumps(columns, ensure_ascii=False).encode("utf-8"))
    truncated = result.truncated

    for raw_row in result.rows:
        safe_row = [json_safe(value) for value in raw_row]
        encoded = json.dumps(safe_row, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if total_bytes + len(encoded) > max_bytes:
            truncated = True
            break
        rows.append(safe_row)
        total_bytes += len(encoded)

    return columns, rows, truncated, total_bytes


def model_result_preview(
    *,
    columns: list[str],
    rows: list[list[object]],
    truncated: bool,
    max_rows: int,
    max_bytes: int,
) -> dict[str, object]:
    preview_rows: list[list[object]] = []
    used = len(json.dumps(columns, ensure_ascii=False).encode("utf-8"))
    preview_truncated = truncated or len(rows) > max_rows
    for row in rows[:max_rows]:
        encoded = json.dumps(row, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if used + len(encoded) > max_bytes:
            preview_truncated = True
            break
        preview_rows.append(row)
        used += len(encoded)
    return {
        "columns": columns,
        "rows": preview_rows,
        "row_count": len(rows),
        "truncated": preview_truncated,
    }
