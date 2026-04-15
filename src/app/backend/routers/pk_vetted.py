"""PK vetting endpoints for validation jobs and UI."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from backend.dependencies import DBSession, get_db
from backend.models import EntityPkVetConfirm
from backend.services.pk_vetted_service import confirm_pk_vetted, get_pk_vetting_status

router = APIRouter(prefix="/pk-vetted", tags=["pk-vetted"])


@router.get("")
async def pk_vetted_status(
    entity_type: Annotated[str, Query(description="'table' or 'compare_query'")],
    entity_name: Annotated[str, Query()],
    db: DBSession = Depends(get_db),
) -> dict:
    return await get_pk_vetting_status(db, entity_type, entity_name)


@router.post("/vet")
async def pk_vetted_vet(
    body: EntityPkVetConfirm,
    db: DBSession = Depends(get_db),
) -> dict:
    return await confirm_pk_vetted(db, body.entity_type, body.entity_name)
