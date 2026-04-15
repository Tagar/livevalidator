"""Routers module - HTTP layer."""

from backend.routers.admin import router as admin_router
from backend.routers.dashboards import router as dashboards_router
from backend.routers.misc import router as misc_router
from backend.routers.pk_vetted import router as pk_vetted_router
from backend.routers.queries import router as queries_router
from backend.routers.schedules import router as schedules_router
from backend.routers.setup import router as setup_router
from backend.routers.systems import router as systems_router
from backend.routers.tables import router as tables_router
from backend.routers.tags import router as tags_router
from backend.routers.triggers import router as triggers_router
from backend.routers.type_transformations import router as type_transformations_router
from backend.routers.validation_config import router as validation_config_router
from backend.routers.validation_history import router as validation_history_router

__all__ = [
    "tables_router",
    "queries_router",
    "pk_vetted_router",
    "schedules_router",
    "triggers_router",
    "systems_router",
    "validation_history_router",
    "dashboards_router",
    "tags_router",
    "type_transformations_router",
    "validation_config_router",
    "admin_router",
    "setup_router",
    "misc_router",
]
