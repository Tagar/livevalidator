"""Tables router."""

from fastapi import APIRouter, Depends

from backend.dependencies import DBSession, get_current_user_email, get_db
from backend.models import BulkTableRequest, TableIn, TableUpdate
from backend.services.tables_service import TablesService
from backend.services.users_service import UsersService

router = APIRouter(prefix="/tables", tags=["tables"])


@router.get("")
async def list_tables(
    q: str | None = None,
    db: DBSession = Depends(get_db),
):
    service = TablesService(db, "")
    return await service.list_tables(q)


@router.post("")
async def create_table(
    body: TableIn,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_RUN", "CAN_EDIT", "CAN_MANAGE")

    service = TablesService(db, user_email)
    return await service.create_table(body.model_dump())


@router.get("/{id}")
async def get_table(
    id: int,
    db: DBSession = Depends(get_db),
):
    service = TablesService(db, "")
    return await service.get_table(id)


@router.put("/{id}")
async def update_table(
    id: int,
    body: TableUpdate,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    if not await users.can_edit_object(user_email, "tables", id):
        from fastapi import HTTPException

        raise HTTPException(403, "You don't have permission to edit this table")

    service = TablesService(db, user_email)
    return await service.update_table(id, body.model_dump(exclude_unset=True))


@router.delete("/{id}")
async def delete_table(
    id: int,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    if not await users.can_edit_object(user_email, "tables", id):
        from fastapi import HTTPException

        raise HTTPException(403, "You don't have permission to delete this table")

    service = TablesService(db, user_email)
    return await service.delete_table(id)


@router.post("/bulk")
async def bulk_create_tables(
    body: BulkTableRequest,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_RUN", "CAN_EDIT", "CAN_MANAGE")

    service = TablesService(db, user_email)
    items = [item.model_dump() for item in body.items]
    return await service.bulk_create_tables(body.src_system_id, body.tgt_system_id, items)


@router.post("/{id}/fetch-lineage")
async def fetch_lineage_for_table(
    id: int,
    system: str = "source",
    db: DBSession = Depends(get_db),
):
    from backend.services.validation_history_service import ValidationHistoryService

    service = ValidationHistoryService(db)
    return await service.fetch_lineage_for_table(id, system)


@router.patch("/{id}/lineage")
async def update_table_lineage(
    id: int,
    body: dict,
    db: DBSession = Depends(get_db),
):
    service = TablesService(db, "")
    return await service.update_lineage(id, body.get("lineage"))
