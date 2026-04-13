"""Databricks SDK wrapper for testability."""

import os
from typing import Any, Protocol


class DatabricksClientProtocol(Protocol):
    """Protocol for Databricks client - enables mocking."""

    def run_now(self, job_id: int, job_parameters: dict) -> Any: ...
    def get_run(self, run_id: int, include_history: bool = False, include_resolved_values: bool = False) -> Any: ...
    def repair_run(
        self,
        run_id: int,
        rerun_all_failed_tasks: bool = False,
        latest_repair_id: int | None = None,
        job_parameters: dict | None = None,
    ) -> Any: ...


class DatabricksService:
    """Wrapper around Databricks WorkspaceClient for testability."""

    def __init__(self, client: Any | None = None):
        self._client = client
        self._initialized = client is not None

    def _get_client(self) -> Any:
        if not self._initialized:
            from databricks.sdk import WorkspaceClient

            self._client = WorkspaceClient()
            self._initialized = True
        return self._client

    @property
    def host(self) -> str:
        return self._get_client().config.host

    def launch_job(self, job_id: int, params: dict) -> tuple[int, str]:
        """Launch a Databricks job. Returns (run_id, run_url)."""
        client = self._get_client()
        run = client.jobs.run_now(job_id=job_id, job_parameters=params)
        run_url = f"{client.config.host}/jobs/{job_id}/runs/{run.run_id}"
        return run.run_id, run_url

    def get_run_status(self, run_id: int) -> dict:
        """Get run status for a Databricks job run."""
        client = self._get_client()
        run = client.jobs.get_run(run_id=run_id)
        state = run.state

        life_cycle = state.life_cycle_state.value if state.life_cycle_state else None
        result = state.result_state.value if state.result_state else None

        is_failed = (
            result in ("FAILED", "TIMEDOUT", "CANCELED", "MAXIMUM_CONCURRENT_RUNS_REACHED")
            or life_cycle == "INTERNAL_ERROR"
        )
        is_done = life_cycle in ("TERMINATED", "SKIPPED", "INTERNAL_ERROR")

        return {
            "life_cycle_state": life_cycle,
            "result_state": result,
            "failed": is_failed,
            "done": is_done,
            "state_message": state.state_message if state.state_message else None,
        }

    def get_run_statuses(self, run_ids: list[int]) -> dict[int, dict]:
        """Get statuses for multiple runs. Returns {run_id: status_dict}."""
        if not run_ids:
            return {}

        results = {}
        for run_id in run_ids:
            try:
                results[run_id] = self.get_run_status(run_id)
            except Exception as e:
                results[run_id] = {"failed": True, "done": True, "error": str(e)}
        return results

    def repair_run(self, run_id: int) -> dict:
        """Repair a failed run. Returns repair info."""
        client = self._get_client()

        run_info = client.jobs.get_run(run_id=run_id, include_history=True, include_resolved_values=True)

        latest_repair_id = None
        if run_info.repair_history:
            latest_repair_id = run_info.repair_history[-1].id

        original_params = None
        if run_info.job_parameters:
            original_params = {p.name: p.value for p in run_info.job_parameters}

        repair_waiter = client.jobs.repair_run(
            run_id=run_id,
            rerun_all_failed_tasks=True,
            latest_repair_id=latest_repair_id,
            job_parameters=original_params,
        )

        repair_id = (
            repair_waiter.response.repair_id if hasattr(repair_waiter, "response") and repair_waiter.response else None
        )

        updated_run = client.jobs.get_run(run_id=run_id)
        new_run_url = updated_run.run_page_url

        return {"repair_id": repair_id, "run_url": new_run_url}

    @staticmethod
    def get_validation_job_id() -> str | None:
        return os.environ.get("VALIDATION_JOB_ID")

    @staticmethod
    def get_validation_serverless_job_id() -> str | None:
        return os.environ.get("VALIDATION_JOB_SERVERLESS_ID")

    @staticmethod
    def get_test_connection_job_id() -> str | None:
        return os.environ.get("TEST_CONNECTION_JOB_ID")

    @staticmethod
    def get_test_connection_serverless_job_id() -> str | None:
        return os.environ.get("TEST_CONNECTION_JOB_SERVERLESS_ID")

    @staticmethod
    def get_lineage_job_id() -> str | None:
        return os.environ.get("LINEAGE_JOB_ID")

    @staticmethod
    def get_backend_url() -> str:
        return os.environ.get("DATABRICKS_APP_URL", "")
