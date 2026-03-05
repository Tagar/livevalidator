"""Dashboards router."""

from fastapi import APIRouter, Depends

from backend.dependencies import DBSession, get_current_user_email, get_db
from backend.models import ChartIn, ChartReorder, ChartUpdate, DashboardIn, DashboardUpdate
from backend.services.dashboards_service import DashboardsService

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


@router.get("")
async def list_dashboards(
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = DashboardsService(db, user_email)
    return await service.list_dashboards()


@router.get("/projects")
async def list_projects(
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = DashboardsService(db, user_email)
    return await service.list_projects()


@router.get("/{id}")
async def get_dashboard(
    id: int,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = DashboardsService(db, user_email)
    return await service.get_dashboard(id)


@router.post("")
async def create_dashboard(
    body: DashboardIn,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = DashboardsService(db, user_email)
    return await service.create_dashboard(body.name, body.project)


@router.put("/{id}")
async def update_dashboard(
    id: int,
    body: DashboardUpdate,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = DashboardsService(db, user_email)
    return await service.update_dashboard(id, body.model_dump(exclude_unset=True))


@router.delete("/{id}")
async def delete_dashboard(
    id: int,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = DashboardsService(db, user_email)
    return await service.delete_dashboard(id)


@router.post("/{id}/clone")
async def clone_dashboard(
    id: int,
    body: dict = None,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    if body is None:
        body = {}
    service = DashboardsService(db, user_email)
    return await service.clone_dashboard(id, body.get("name"), body.get("project"))


@router.post("/{id}/charts")
async def add_chart(
    id: int,
    body: ChartIn,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = DashboardsService(db, user_email)
    return await service.add_chart(id, body.name, body.filters, body.sort_order)


@router.put("/{id}/charts/reorder")
async def reorder_charts(
    id: int,
    body: ChartReorder,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = DashboardsService(db, user_email)
    return await service.reorder_charts(id, body.chart_ids)


@router.put("/{id}/charts/{chart_id}")
async def update_chart(
    id: int,
    chart_id: int,
    body: ChartUpdate,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = DashboardsService(db, user_email)
    return await service.update_chart(id, chart_id, body.model_dump(exclude_unset=True))


@router.delete("/{id}/charts/{chart_id}")
async def delete_chart(
    id: int,
    chart_id: int,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = DashboardsService(db, user_email)
    return await service.delete_chart(id, chart_id)
