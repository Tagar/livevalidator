"""Triggers router."""

from fastapi import APIRouter, Depends

from backend.dependencies import DBSession, get_current_user_email, get_db
from backend.models import BulkRepairRequest, BulkTriggerRequest, TriggerIn
from backend.services.triggers_service import TriggersService
from backend.services.users_service import UsersService

router = APIRouter(prefix="/triggers", tags=["triggers"])


@router.get("")
async def list_triggers(
    status: str | None = None,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = TriggersService(db, user_email)
    return await service.list_triggers(status)


@router.post("")
async def create_trigger(
    body: TriggerIn,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_RUN", "CAN_EDIT", "CAN_MANAGE")

    service = TriggersService(db, user_email)
    return await service.create_trigger(body.model_dump())


@router.post("/bulk")
async def create_triggers_bulk(
    triggers: list[TriggerIn],
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = TriggersService(db, user_email)
    return await service.create_triggers_bulk([t.model_dump() for t in triggers])


@router.post("/bulk-create")
async def bulk_create_triggers(
    body: BulkTriggerRequest,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_RUN", "CAN_EDIT", "CAN_MANAGE")

    service = TriggersService(db, user_email)
    return await service.bulk_create_triggers(body.entity_type, body.entity_ids)


@router.delete("/{id}")
async def cancel_trigger(
    id: int,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = TriggersService(db, user_email)
    return await service.cancel_trigger(id)


@router.post("/{id}/launch")
async def launch_trigger(
    id: int,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_RUN", "CAN_EDIT", "CAN_MANAGE")

    service = TriggersService(db, user_email)
    return await service.launch_trigger(id)


@router.post("/bulk-launch")
async def bulk_launch_triggers(
    body: dict,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_RUN", "CAN_EDIT", "CAN_MANAGE")

    service = TriggersService(db, user_email)
    return await service.bulk_launch_triggers(body.get("trigger_ids", []))


@router.post("/{id}/repair")
async def repair_trigger_run(
    id: int,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_RUN", "CAN_EDIT", "CAN_MANAGE")

    service = TriggersService(db, user_email)
    return await service.repair_trigger(id)


@router.post("/bulk-repair")
async def bulk_repair_triggers(
    body: BulkRepairRequest,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    users = UsersService(db)
    await users.require_role(user_email, "CAN_RUN", "CAN_EDIT", "CAN_MANAGE")

    service = TriggersService(db, user_email)
    return await service.bulk_repair_triggers(body.trigger_ids)


@router.get("/running-per-system")
async def get_running_per_system(
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = TriggersService(db, user_email)
    return await service.get_running_per_system()


@router.get("/next")
async def get_next_trigger(
    worker_id: str = "worker-default",
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = TriggersService(db, user_email)
    return await service.get_next_trigger(worker_id)


@router.put("/{id}/update-run-id")
async def update_trigger_run_id(
    id: int,
    body: dict,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = TriggersService(db, user_email)
    return await service.update_trigger_run_id(id, body["run_id"], body.get("run_url"))


@router.put("/{id}/release")
async def release_trigger(
    id: int,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = TriggersService(db, user_email)
    return await service.release_trigger(id)


@router.put("/{id}/fail")
async def fail_trigger(
    id: int,
    body: dict,
    db: DBSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
):
    service = TriggersService(db, user_email)
    return await service.fail_trigger(
        id,
        body.get("status", "error"),
        body.get("error_message", "Worker failed to launch job"),
        body.get("error_details"),
    )
