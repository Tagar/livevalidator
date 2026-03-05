"""Systems router."""

from fastapi import APIRouter, Depends

from backend.dependencies import DBSession, get_current_user_email, get_db
from backend.models import SystemIn, SystemUpdate
from backend.services.systems_service import SystemsService
from backend.services.users_service import UsersService

router = APIRouter(prefix="/systems", tags=["systems"])


@router.get("")
async def list_systems(db: DBSession = Depends(get_db)):
    service = SystemsService(db, "")
    return await service.list_systems()


@router.post("")
async def create_system(
    body: SystemIn,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_MANAGE")

    service = SystemsService(db, user_email)
    return await service.create_system(body.model_dump())


@router.get("/{id}")
async def get_system(
    id: int,
    db: DBSession = Depends(get_db),
):
    service = SystemsService(db, "")
    return await service.get_system(id)


@router.get("/name/{name}")
async def get_system_by_name(
    name: str,
    db: DBSession = Depends(get_db),
):
    service = SystemsService(db, "")
    return await service.get_system_by_name(name)


@router.put("/{id}")
async def update_system(
    id: int,
    body: SystemUpdate,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_MANAGE")

    service = SystemsService(db, user_email)
    return await service.update_system(id, body.model_dump(exclude_unset=True))


@router.delete("/{id}")
async def delete_system(
    id: int,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_MANAGE")

    service = SystemsService(db, user_email)
    return await service.delete_system(id)
