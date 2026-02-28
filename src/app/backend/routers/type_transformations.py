"""Type transformations router."""

from fastapi import APIRouter, Depends

from backend.dependencies import DBSession, get_current_user_email, get_db
from backend.models import TypeTransformationIn, TypeTransformationUpdate
from backend.services.type_transformations_service import TypeTransformationsService
from backend.services.users_service import UsersService

router = APIRouter(prefix="/type-transformations", tags=["type-transformations"])


@router.get("")
async def list_type_transformations(db: DBSession = Depends(get_db)):
    service = TypeTransformationsService(db, "")
    return await service.list_type_transformations()


@router.get("/default/{system_kind}")
async def get_default_transformation_for_system(
    system_kind: str,
    db: DBSession = Depends(get_db),
):
    service = TypeTransformationsService(db, "")
    return service.get_default_transformation_for_system(system_kind)


@router.get("/for-validation/{system_a_id}/{system_b_id}")
async def get_type_transformation_for_validation(
    system_a_id: int,
    system_b_id: int,
    db: DBSession = Depends(get_db),
):
    service = TypeTransformationsService(db, "")
    return await service.get_type_transformation_for_validation(system_a_id, system_b_id)


@router.get("/{system_a_id}/{system_b_id}")
async def get_type_transformation(
    system_a_id: int,
    system_b_id: int,
    db: DBSession = Depends(get_db),
):
    service = TypeTransformationsService(db, "")
    return await service.get_type_transformation(system_a_id, system_b_id)


@router.post("")
async def create_type_transformation(
    body: TypeTransformationIn,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_MANAGE")

    service = TypeTransformationsService(db, user_email)
    return await service.create_type_transformation(body.model_dump())


@router.put("/{system_a_id}/{system_b_id}")
async def update_type_transformation(
    system_a_id: int,
    system_b_id: int,
    body: TypeTransformationUpdate,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_MANAGE")

    service = TypeTransformationsService(db, user_email)
    return await service.update_type_transformation(system_a_id, system_b_id, body.model_dump(exclude_unset=True))


@router.delete("/{system_a_id}/{system_b_id}")
async def delete_type_transformation(
    system_a_id: int,
    system_b_id: int,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_MANAGE")

    service = TypeTransformationsService(db, user_email)
    return await service.delete_type_transformation(system_a_id, system_b_id)
