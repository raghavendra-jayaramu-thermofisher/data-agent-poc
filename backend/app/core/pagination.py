"""Opaque keyset cursors for application list endpoints.

A cursor carries only the sort-key values of the last delivered row plus a fingerprint of the
list it belongs to (organization, parent resource and filters). It is HMAC-signed so clients
cannot forge positions or replay a cursor against another organization or filter. Authorization
is still checked on every request; the cursor never grants access by itself.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import uuid
from collections.abc import Callable, Sequence
from datetime import datetime
from typing import Any

from pydantic import BaseModel
from sqlalchemy import Select, tuple_
from sqlalchemy.sql.elements import ColumnElement

from app.core.config import Settings
from app.core.errors import AppError

DEFAULT_PAGE_SIZE = 30
MAX_PAGE_SIZE = 100
_VERSION = 1
_SIGNATURE_BYTES = 16


class CursorPage[T](BaseModel):
    items: list[T]
    next_cursor: str | None
    has_more: bool


def _encode_value(value: object) -> object:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


class CursorCodec:
    def __init__(self, settings: Settings, scope: str, *binding: object) -> None:
        self._key = hmac.new(settings.jwt_secret.encode(), b"list-cursor", hashlib.sha256).digest()
        self._binding = hashlib.sha256(
            json.dumps([scope, *map(_encode_value, binding)], separators=(",", ":")).encode()
        ).hexdigest()[:32]

    def _sign(self, body: bytes) -> bytes:
        return hmac.new(self._key, body, hashlib.sha256).digest()[:_SIGNATURE_BYTES]

    def encode(self, values: Sequence[object]) -> str:
        body = json.dumps(
            {"v": _VERSION, "b": self._binding, "k": [_encode_value(value) for value in values]},
            separators=(",", ":"),
        ).encode()
        return _b64(body + self._sign(body))

    def decode(self, cursor: str, parsers: Sequence[Callable[[Any], object]]) -> list[object]:
        try:
            raw = _unb64(cursor)
            body, signature = raw[:-_SIGNATURE_BYTES], raw[-_SIGNATURE_BYTES:]
            if len(raw) <= _SIGNATURE_BYTES or not hmac.compare_digest(signature, self._sign(body)):
                raise ValueError("signature")
            payload = json.loads(body)
            if payload["v"] != _VERSION or payload["b"] != self._binding:
                raise ValueError("binding")
            keys = payload["k"]
            if len(keys) != len(parsers):
                raise ValueError("shape")
            return [parse(value) for parse, value in zip(parsers, keys, strict=True)]
        except (ValueError, KeyError, TypeError, binascii.Error, UnicodeDecodeError) as exc:
            raise AppError(
                "INVALID_CURSOR", "The page cursor is invalid or belongs to a different list.", 400
            ) from exc


def keyset_page(
    statement: Select,
    columns: Sequence[ColumnElement[Any]],
    *,
    after: Sequence[object] | None,
    descending: bool,
    limit: int,
) -> Select:
    """Order by a unique column tuple, continue after a key and fetch one lookahead row."""
    if after is not None:
        key = tuple_(*columns)
        statement = statement.where(key < tuple_(*after) if descending else key > tuple_(*after))
    order = [column.desc() if descending else column.asc() for column in columns]
    return statement.order_by(*order).limit(limit + 1)


def split_page[T](rows: Sequence[T], limit: int) -> tuple[list[T], bool]:
    return list(rows[:limit]), len(rows) > limit
