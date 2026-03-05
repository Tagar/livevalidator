"""Validation config router."""

from fastapi import APIRouter, Depends

from backend.dependencies import DBSession, get_current_user_email, get_db
from backend.models import ValidatePythonCode
from backend.services.type_transformations_service import TypeTransformationsService
from backend.services.validation_config_service import ValidationConfigService

router = APIRouter(tags=["validation-config"])


@router.get("/validation-config")
async def get_validation_config(db: DBSession = Depends(get_db)):
    service = ValidationConfigService(db)
    return await service.get_validation_config()


@router.put("/validation-config")
async def update_validation_config(
    body: dict,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = ValidationConfigService(db, user_email)
    return await service.update_validation_config(body)


@router.post("/validate-python")
async def validate_python_code(
    body: ValidatePythonCode,
    db: DBSession = Depends(get_db),
):
    service = TypeTransformationsService(db, "")
    return service.validate_python_code(body.code)
