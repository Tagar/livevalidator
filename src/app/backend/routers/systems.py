"""Systems router."""

from fastapi import APIRouter, Depends, HTTPException

from backend.dependencies import DBSession, get_current_user_email, get_db
from backend.models import SystemIn, SystemUpdate
from backend.services.databricks_service import DatabricksService
from backend.services.systems_service import SystemsService
from backend.services.users_service import UsersService

router = APIRouter(prefix="/systems", tags=["systems"])
_databricks = DatabricksService()


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


@router.post("/{id}/test")
async def test_connection(
    id: int,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    """Launch test connection job(s) based on the system's compute_mode."""
    users = UsersService(db)
    await users.require_role(user_email, "CAN_MANAGE")

    service = SystemsService(db, user_email)
    system = await service.get_system(id)

    backend_url = DatabricksService.get_backend_url()
    params = {"system_name": system["name"], "backend_api_url": backend_url}

    compute_mode: str = system.get("compute_mode", "classic")
    tests: list[dict] = []

    if compute_mode in ("classic", "prefer_serverless"):
        job_id = _databricks.get_test_connection_job_id()
        if not job_id:
            raise HTTPException(500, "TEST_CONNECTION_JOB_ID not configured")
        run_id, run_url = _databricks.launch_job(int(job_id), params)
        tests.append({"compute": "classic", "run_id": run_id, "run_url": run_url})

    if compute_mode in ("require_serverless", "prefer_serverless"):
        job_id = _databricks.get_test_connection_serverless_job_id()
        if not job_id:
            raise HTTPException(500, "TEST_CONNECTION_JOB_SERVERLESS_ID not configured")
        run_id, run_url = _databricks.launch_job(int(job_id), params)
        tests.append({"compute": "serverless", "run_id": run_id, "run_url": run_url})

    return {"tests": tests}


@router.get("/{id}/test/{run_id}/status")
async def test_connection_status(
    id: int,
    run_id: int,
    db: DBSession = Depends(get_db),
):
    """Poll the status of a test connection job run."""
    status = _databricks.get_run_status(run_id)

    if status.get("done"):
        state = "FAILED" if status.get("failed") else "SUCCESS"
    else:
        state = "RUNNING"

    return {
        "state": state,
        "error": status.get("state_message") if status.get("failed") else None,
    }
