"""Setup router for database initialization."""

from fastapi import APIRouter, Depends

from backend.dependencies import DBSession, get_db
from backend.services.setup_service import SetupService

router = APIRouter(prefix="/setup", tags=["setup"])


@router.post("/initialize-database")
async def initialize_database(db: DBSession = Depends(get_db)):
    service = SetupService(db)
    return await service.initialize_database()


@router.post("/reset-database")
async def reset_database(db: DBSession = Depends(get_db)):
    service = SetupService(db)
    return await service.reset_database()
