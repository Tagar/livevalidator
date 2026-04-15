"""PK vetting status for entities (datasets / compare_queries)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import HTTPException

if TYPE_CHECKING:
    from backend.dependencies import DBSession


def _entity_table(entity_type: str) -> str:
    if entity_type == "table":
        return "control.datasets"
    if entity_type == "compare_query":
        return "control.compare_queries"
    raise HTTPException(status_code=400, detail="entity_type must be 'table' or 'compare_query'")


async def get_pk_vetting_status(db: DBSession, entity_type: str, entity_name: str) -> dict:
    table = _entity_table(entity_type)
    row = await db.fetchrow(f"SELECT pk_vetted FROM {table} WHERE name = $1", entity_name.strip())
    if not row:
        raise HTTPException(status_code=404, detail="entity not found")
    return {"pk_vetted": bool(row["pk_vetted"])}


async def confirm_pk_vetted(db: DBSession, entity_type: str, entity_name: str) -> dict:
    table = _entity_table(entity_type)
    row = await db.fetchrow(f"SELECT id FROM {table} WHERE name = $1", entity_name.strip())
    if not row:
        raise HTTPException(status_code=404, detail="entity not found")
    await db.execute(f"UPDATE {table} SET pk_vetted = TRUE WHERE id = $1", row["id"])
    return {"ok": True}
