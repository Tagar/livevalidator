"""Shared utility functions."""

from datetime import datetime
from typing import Any

from fastapi import HTTPException


def normalize_pk_columns(cols: list[str] | list[Any] | None) -> tuple[str, ...]:
    """Lowercase, strip, sort PK column names for stable equality (TEXT[] vs job list)."""
    if not cols:
        return ()
    out: list[str] = []
    for c in cols:
        if c is None:
            continue
        s = str(c).strip().lower()
        if s:
            out.append(s)
    return tuple(sorted(out))


def serialize_row(row: dict | None) -> dict | None:
    """Convert a database row to a JSON-serializable dict (handles datetime)."""
    if row is None:
        return None
    result = dict(row)
    for k, v in result.items():
        if isinstance(v, datetime):
            result[k] = v.isoformat()
    return result


def raise_version_conflict(current: dict | None) -> None:
    """Raise a 409 version conflict error with the current record state."""
    raise HTTPException(
        status_code=409,
        detail={"error": "version_conflict", "current": serialize_row(current)},
    )
