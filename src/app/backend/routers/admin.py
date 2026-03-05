"""Admin router for user/config management."""

from fastapi import APIRouter, Depends

from backend.dependencies import DBSession, get_current_user_email, get_db
from backend.services.users_service import UsersService

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
async def list_user_roles(
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_MANAGE")
    return await users.list_users()


@router.put("/users/{target_user_email}/role")
async def set_user_role(
    target_user_email: str,
    role: str,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_MANAGE")
    return await users.set_user_role(target_user_email, role, user_email)


@router.delete("/users/{target_user_email}/role")
async def delete_user_role(
    target_user_email: str,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_MANAGE")
    return await users.delete_user_role(target_user_email)


@router.get("/config")
async def get_app_config(
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_MANAGE")
    return await users.get_app_config()


@router.put("/config/{key}")
async def update_app_config(
    key: str,
    value: str,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_MANAGE")
    return await users.update_app_config(key, value, user_email)
