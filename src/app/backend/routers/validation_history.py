"""Validation history router."""

from fastapi import APIRouter, Depends

from backend.dependencies import DBSession, get_db
from backend.services.validation_history_service import ValidationHistoryService

router = APIRouter(prefix="/validation-history", tags=["validation-history"])


@router.get("")
async def list_validation_history(
    limit: int = 100,
    offset: int = 0,
    entity_type: str | None = None,
    entity_id: int | None = None,
    entity_name: str | None = None,
    status: str | None = None,
    schedule_id: int | None = None,
    source_system: str | None = None,
    target_system: str | None = None,
    tags: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    days_back: int = 0,
    sort_by: str = "requested_at",
    sort_dir: str = "desc",
    db: DBSession = Depends(get_db),
):
    service = ValidationHistoryService(db)
    return await service.list_validation_history(
        limit=limit,
        offset=offset,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        status=status,
        schedule_id=schedule_id,
        source_system=source_system,
        target_system=target_system,
        tags=tags,
        date_from=date_from,
        date_to=date_to,
        days_back=days_back,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )


@router.get("/{id}")
async def get_validation_detail(
    id: int,
    db: DBSession = Depends(get_db),
):
    service = ValidationHistoryService(db)
    return await service.get_validation_detail(id)


@router.get("/entity/{entity_type}/{entity_id}/latest")
async def get_latest_validation(
    entity_type: str,
    entity_id: int,
    db: DBSession = Depends(get_db),
):
    service = ValidationHistoryService(db)
    return await service.get_latest_validation(entity_type, entity_id)


@router.post("")
async def create_validation_history(
    body: dict,
    db: DBSession = Depends(get_db),
):
    service = ValidationHistoryService(db)
    return await service.create_validation_history(body)


@router.patch("/{id}")
async def update_validation_history(
    id: int,
    body: dict,
    db: DBSession = Depends(get_db),
):
    service = ValidationHistoryService(db)
    return await service.update_validation_history(id, body)


@router.delete("")
async def delete_validation_history(
    body: dict,
    db: DBSession = Depends(get_db),
):
    service = ValidationHistoryService(db)
    return await service.delete_validation_history(body.get("ids", []))
