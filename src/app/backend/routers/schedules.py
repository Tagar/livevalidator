"""Schedules router."""

from fastapi import APIRouter, Depends, HTTPException

from backend.dependencies import DBSession, get_current_user_email, get_db
from backend.models import ScheduleIn, ScheduleUpdate
from backend.services.schedules_service import SchedulesService
from backend.services.users_service import UsersService

router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.get("")
async def list_schedules(db: DBSession = Depends(get_db)):
    service = SchedulesService(db, "")
    return await service.list_schedules()


@router.post("")
async def create_schedule(
    body: ScheduleIn,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_RUN", "CAN_EDIT", "CAN_MANAGE")

    service = SchedulesService(db, user_email)
    return await service.create_schedule(body.model_dump())


@router.put("/{id}")
async def update_schedule(
    id: int,
    body: ScheduleUpdate,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    if not await users.can_edit_object(user_email, "schedules", id):
        raise HTTPException(403, "You don't have permission to edit this schedule")

    service = SchedulesService(db, user_email)
    return await service.update_schedule(id, body.model_dump(exclude_unset=True))


@router.delete("/{id}")
async def delete_schedule(
    id: int,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    if not await users.can_edit_object(user_email, "schedules", id):
        raise HTTPException(403, "You don't have permission to delete this schedule")

    service = SchedulesService(db, user_email)
    return await service.delete_schedule(id)
