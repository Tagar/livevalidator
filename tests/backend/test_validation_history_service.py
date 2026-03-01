"""Tests for backend/services/validation_history_service.py."""

from datetime import datetime

import pytest
from fastapi import HTTPException

from backend.services.validation_history_service import (
    ValidationHistoryService,
    _transform_pk_samples_to_legacy,
)
from tests.backend.conftest import MockDBSession


class TestTransformPKSamplesToLegacy:
    """Tests for the _transform_pk_samples_to_legacy helper function."""

    def test_returns_none_for_none_input(self):
        assert _transform_pk_samples_to_legacy(None) is None

    def test_parses_json_string(self):
        json_str = '{"mode": "except_all", "samples": []}'
        result = _transform_pk_samples_to_legacy(json_str)
        assert result == {"mode": "except_all", "samples": []}

    def test_returns_input_for_invalid_json(self):
        result = _transform_pk_samples_to_legacy("not valid json")
        assert result == "not valid json"

    def test_passthrough_for_except_all_mode(self):
        """except_all mode should pass through unchanged."""
        data = {
            "mode": "row_count_mismatch_except_all",
            "data": {
                "column_differences": [{"col": "name", "src": 10, "tgt": 12}],
                "in_source_not_target": {"count": 5, "samples": [{"id": 1}]},
                "in_target_not_source": {"count": 3, "samples": [{"id": 2}]},
            },
        }
        result = _transform_pk_samples_to_legacy(data)
        assert result == data

    def test_passthrough_for_pk_row_count_mismatch(self):
        """PK row count mismatch format should pass through unchanged."""
        data = {
            "mode": "row_count_mismatch",
            "skipped": False,
            "pk_columns": ["id"],
            "missing_in_target": {"count": 2, "summary": [], "samples": [{"id": 1}]},
            "missing_in_source": {"count": 1, "summary": [], "samples": [{"id": 5}]},
        }
        result = _transform_pk_samples_to_legacy(data)
        assert result == data

    def test_passthrough_for_plain_sample_list(self):
        """Plain list of sample diffs (pre-analysis) should pass through."""
        data = [{"id": 1, "name": "test"}, {"id": 2, "name": "other"}]
        result = _transform_pk_samples_to_legacy(data)
        assert result == data

    def test_passthrough_for_pk_mode_without_system_marker(self):
        """PK mode without .system markers (already legacy format) passes through."""
        data = {
            "mode": "primary_key",
            "pk_columns": ["id"],
            "samples": [
                {"pk": {"id": 1}, "differences": [{"column": "name", "source_value": "a", "target_value": "b"}]}
            ],
        }
        result = _transform_pk_samples_to_legacy(data)
        assert result == data

    def test_transforms_pk_mode_with_system_markers(self):
        """PK mode with .system markers should transform to legacy nested format."""
        data = {
            "mode": "primary_key",
            "pk_columns": ["id"],
            "samples": [
                {".system": "source_db", "id": 1, "name": "foo", "value": 100},
                {".system": "target_db", "id": 1, "name": "bar", "value": 200},
            ],
        }
        result = _transform_pk_samples_to_legacy(data)

        assert result["mode"] == "primary_key"
        assert result["pk_columns"] == ["id"]
        assert len(result["samples"]) == 1

        sample = result["samples"][0]
        assert sample["pk"] == {"id": 1}
        assert len(sample["differences"]) == 2

        diff_cols = {d["column"] for d in sample["differences"]}
        assert diff_cols == {"name", "value"}

    def test_transforms_multiple_pk_columns(self):
        """Handles composite primary keys."""
        data = {
            "mode": "primary_key",
            "pk_columns": ["org_id", "user_id"],
            "samples": [
                {".system": "src", "org_id": 1, "user_id": 10, "email": "old@test.com"},
                {".system": "tgt", "org_id": 1, "user_id": 10, "email": "new@test.com"},
            ],
        }
        result = _transform_pk_samples_to_legacy(data)

        assert result["samples"][0]["pk"] == {"org_id": 1, "user_id": 10}
        assert result["samples"][0]["differences"][0]["column"] == "email"

    def test_handles_multiple_mismatched_rows(self):
        """Handles multiple different PKs with mismatches."""
        data = {
            "mode": "primary_key",
            "pk_columns": ["id"],
            "samples": [
                {".system": "src", "id": 1, "name": "a"},
                {".system": "tgt", "id": 1, "name": "b"},
                {".system": "src", "id": 2, "name": "x"},
                {".system": "tgt", "id": 2, "name": "y"},
            ],
        }
        result = _transform_pk_samples_to_legacy(data)

        assert len(result["samples"]) == 2
        pks = {s["pk"]["id"] for s in result["samples"]}
        assert pks == {1, 2}

    def test_skips_rows_missing_source_or_target(self):
        """Rows without both source and target are skipped."""
        data = {
            "mode": "primary_key",
            "pk_columns": ["id"],
            "samples": [
                {".system": "src", "id": 1, "name": "only_source"},
                # No target for id=1
                {".system": "src", "id": 2, "name": "a"},
                {".system": "tgt", "id": 2, "name": "b"},
            ],
        }
        result = _transform_pk_samples_to_legacy(data)

        # Only id=2 has both source and target
        assert len(result["samples"]) == 1
        assert result["samples"][0]["pk"]["id"] == 2


@pytest.fixture
def sample_validation() -> dict:
    return {
        "id": 1,
        "trigger_id": 1,
        "entity_type": "table",
        "entity_id": 1,
        "entity_name": "test.table",
        "source": "manual",
        "schedule_id": None,
        "requested_by": "test@test.com",
        "requested_at": datetime(2024, 1, 15, 10, 0, 0),
        "started_at": datetime(2024, 1, 15, 10, 0, 5),
        "finished_at": datetime(2024, 1, 15, 10, 1, 0),
        "duration_seconds": 55,
        "source_system_name": "Source",
        "target_system_name": "Target",
        "source_table": "source.table",
        "target_table": "target.table",
        "pk_columns": [],
        "status": "succeeded",
        "schema_match": True,
        "row_count_match": True,
        "row_count_source": 100,
        "row_count_target": 100,
        "rows_compared": 100,
        "rows_different": 0,
        "difference_pct": 0.0,
        "compare_mode": "except_all",
        "error_message": None,
        "databricks_run_url": "https://databricks.com/run/123",
    }


class TestListValidationHistory:
    async def test_returns_results_with_stats(self, mock_db: MockDBSession, sample_validation):
        mock_db.set_fetchrow_results({"total": 1, "succeeded": 1, "failed": 0, "errors": 0})
        mock_db.set_fetch_results([sample_validation], [])  # results then tags
        service = ValidationHistoryService(mock_db)
        result = await service.list_validation_history()
        assert "data" in result
        assert "stats" in result
        assert result["stats"]["total"] == 1

    async def test_filters_by_entity_type(self, mock_db: MockDBSession, sample_validation):
        mock_db.set_fetchrow_results({"total": 1, "succeeded": 1, "failed": 0, "errors": 0})
        mock_db.set_fetch_results([sample_validation], [])
        service = ValidationHistoryService(mock_db)
        result = await service.list_validation_history(entity_type="table")
        assert len(result["data"]) == 1
        # Verify entity_type was added to query params
        calls = mock_db.get_calls("fetchrow")
        assert any("table" in str(call[1]) for call in calls)

    async def test_filters_by_date_from(self, mock_db: MockDBSession, sample_validation):
        mock_db.set_fetchrow_results({"total": 1, "succeeded": 1, "failed": 0, "errors": 0})
        mock_db.set_fetch_results([sample_validation], [])
        service = ValidationHistoryService(mock_db)
        result = await service.list_validation_history(date_from="2024-01-01T00:00:00Z")
        assert "data" in result

    async def test_filters_by_days_back(self, mock_db: MockDBSession, sample_validation):
        mock_db.set_fetchrow_results({"total": 1, "succeeded": 1, "failed": 0, "errors": 0})
        mock_db.set_fetch_results([sample_validation], [])
        service = ValidationHistoryService(mock_db)
        result = await service.list_validation_history(days_back=7)
        assert "data" in result

    async def test_filters_by_date_to(self, mock_db: MockDBSession, sample_validation):
        mock_db.set_fetchrow_results({"total": 1, "succeeded": 1, "failed": 0, "errors": 0})
        mock_db.set_fetch_results([sample_validation], [])
        service = ValidationHistoryService(mock_db)
        result = await service.list_validation_history(date_to="2024-12-31T23:59:59Z")
        assert "data" in result

    async def test_filters_by_entity_id(self, mock_db: MockDBSession, sample_validation):
        mock_db.set_fetchrow_results({"total": 1, "succeeded": 1, "failed": 0, "errors": 0})
        mock_db.set_fetch_results([sample_validation], [])
        service = ValidationHistoryService(mock_db)
        result = await service.list_validation_history(entity_id=42)
        assert "data" in result

    async def test_filters_by_entity_name(self, mock_db: MockDBSession, sample_validation):
        mock_db.set_fetchrow_results({"total": 1, "succeeded": 1, "failed": 0, "errors": 0})
        mock_db.set_fetch_results([sample_validation], [])
        service = ValidationHistoryService(mock_db)
        result = await service.list_validation_history(entity_name="test")
        assert "data" in result

    async def test_filters_by_status(self, mock_db: MockDBSession, sample_validation):
        mock_db.set_fetchrow_results({"total": 1, "succeeded": 1, "failed": 0, "errors": 0})
        mock_db.set_fetch_results([sample_validation], [])
        service = ValidationHistoryService(mock_db)
        result = await service.list_validation_history(status="succeeded")
        assert "data" in result

    async def test_filters_by_schedule_id(self, mock_db: MockDBSession, sample_validation):
        mock_db.set_fetchrow_results({"total": 1, "succeeded": 1, "failed": 0, "errors": 0})
        mock_db.set_fetch_results([sample_validation], [])
        service = ValidationHistoryService(mock_db)
        result = await service.list_validation_history(schedule_id=5)
        assert "data" in result

    async def test_filters_by_source_system(self, mock_db: MockDBSession, sample_validation):
        mock_db.set_fetchrow_results({"total": 1, "succeeded": 1, "failed": 0, "errors": 0})
        mock_db.set_fetch_results([sample_validation], [])
        service = ValidationHistoryService(mock_db)
        result = await service.list_validation_history(source_system="Databricks")
        assert "data" in result

    async def test_filters_by_target_system(self, mock_db: MockDBSession, sample_validation):
        mock_db.set_fetchrow_results({"total": 1, "succeeded": 1, "failed": 0, "errors": 0})
        mock_db.set_fetch_results([sample_validation], [])
        service = ValidationHistoryService(mock_db)
        result = await service.list_validation_history(target_system="Postgres")
        assert "data" in result

    async def test_filters_by_tags(self, mock_db: MockDBSession, sample_validation):
        mock_db.set_fetchrow_results({"total": 1, "succeeded": 1, "failed": 0, "errors": 0})
        mock_db.set_fetch_results([sample_validation], [])
        service = ValidationHistoryService(mock_db)
        result = await service.list_validation_history(tags="prod,critical")
        assert "data" in result

    async def test_combined_filters(self, mock_db: MockDBSession, sample_validation):
        """Test multiple filters combined."""
        mock_db.set_fetchrow_results({"total": 1, "succeeded": 1, "failed": 0, "errors": 0})
        mock_db.set_fetch_results([sample_validation], [])
        service = ValidationHistoryService(mock_db)
        result = await service.list_validation_history(
            entity_type="table",
            status="failed",
            source_system="Databricks",
            days_back=7,
        )
        assert "data" in result

    async def test_sort_ascending(self, mock_db: MockDBSession, sample_validation):
        mock_db.set_fetchrow_results({"total": 1, "succeeded": 1, "failed": 0, "errors": 0})
        mock_db.set_fetch_results([sample_validation], [])
        service = ValidationHistoryService(mock_db)
        result = await service.list_validation_history(sort_by="entity_name", sort_dir="asc")
        assert "data" in result


class TestGetValidationDetail:
    async def test_returns_validation(self, mock_db: MockDBSession, sample_validation):
        mock_db.set_fetchrow_results({**sample_validation, "sample_differences": None})
        service = ValidationHistoryService(mock_db)
        result = await service.get_validation_detail(1)
        assert result["id"] == 1

    async def test_raises_404_if_not_found(self, mock_db: MockDBSession):
        mock_db.set_fetchrow_results(None)
        service = ValidationHistoryService(mock_db)
        with pytest.raises(HTTPException) as exc_info:
            await service.get_validation_detail(999)
        assert exc_info.value.status_code == 404

    async def test_transforms_pk_samples_with_system_markers(self, mock_db: MockDBSession, sample_validation):
        """Verifies PK samples with .system markers are transformed to legacy format."""
        pk_data = {
            "mode": "primary_key",
            "pk_columns": ["id"],
            "samples": [
                {".system": "source", "id": 1, "name": "foo"},
                {".system": "target", "id": 1, "name": "bar"},
            ],
        }
        mock_db.set_fetchrow_results({**sample_validation, "sample_differences": pk_data})
        service = ValidationHistoryService(mock_db)
        result = await service.get_validation_detail(1)

        # Should be transformed to nested format
        samples = result["sample_differences"]["samples"]
        assert len(samples) == 1
        assert samples[0]["pk"] == {"id": 1}
        assert samples[0]["differences"][0]["column"] == "name"

    async def test_passthrough_except_all_row_count_mismatch(self, mock_db: MockDBSession, sample_validation):
        """except_all row count mismatch format passes through unchanged."""
        except_all_data = {
            "mode": "row_count_mismatch_except_all",
            "data": {
                "column_differences": [{"col": "status", "src_count": 10, "tgt_count": 8}],
                "in_source_not_target": {"count": 5, "samples": [{"id": 1}]},
                "in_target_not_source": {"count": 3, "samples": [{"id": 2}]},
            },
        }
        mock_db.set_fetchrow_results({**sample_validation, "sample_differences": except_all_data})
        service = ValidationHistoryService(mock_db)
        result = await service.get_validation_detail(1)

        assert result["sample_differences"]["mode"] == "row_count_mismatch_except_all"
        assert result["sample_differences"]["data"]["in_source_not_target"]["count"] == 5

    async def test_passthrough_pk_row_count_mismatch(self, mock_db: MockDBSession, sample_validation):
        """PK row count mismatch format passes through unchanged."""
        pk_mismatch_data = {
            "mode": "row_count_mismatch",
            "skipped": False,
            "pk_columns": ["id"],
            "missing_in_target": {"count": 2, "summary": [], "samples": [{"id": 1}]},
            "missing_in_source": {"count": 1, "summary": [], "samples": [{"id": 5}]},
        }
        mock_db.set_fetchrow_results({**sample_validation, "sample_differences": pk_mismatch_data})
        service = ValidationHistoryService(mock_db)
        result = await service.get_validation_detail(1)

        assert result["sample_differences"]["mode"] == "row_count_mismatch"
        assert result["sample_differences"]["missing_in_target"]["count"] == 2

    async def test_passthrough_plain_sample_list(self, mock_db: MockDBSession, sample_validation):
        """Plain sample list (pre-analysis) passes through."""
        plain_samples = [{"id": 1, "name": "test"}, {"id": 2, "name": "other"}]
        mock_db.set_fetchrow_results({**sample_validation, "sample_differences": plain_samples})
        service = ValidationHistoryService(mock_db)
        result = await service.get_validation_detail(1)

        assert result["sample_differences"] == plain_samples


class TestGetLatestValidation:
    async def test_returns_latest(self, mock_db: MockDBSession, sample_validation):
        mock_db.set_fetchrow_results({**sample_validation, "sample_differences": None})
        service = ValidationHistoryService(mock_db)
        result = await service.get_latest_validation("table", 1)
        assert result["id"] == 1

    async def test_returns_none_when_no_history(self, mock_db: MockDBSession):
        mock_db.set_fetchrow_results(None)
        service = ValidationHistoryService(mock_db)
        result = await service.get_latest_validation("table", 999)
        assert result is None


class TestCreateValidationHistory:
    async def test_creates_history_record(self, mock_db: MockDBSession):
        mock_db.set_fetchrow_results(
            {"databricks_run_url": "http://run", "databricks_run_id": "123", "entity_id": 1, "requested_at": datetime(2024, 1, 15)},
            {"id": 99},  # returned from INSERT
        )
        service = ValidationHistoryService(mock_db)
        result = await service.create_validation_history({
            "trigger_id": 1,
            "entity_type": "table",
            "entity_name": "test.table",
            "source": "manual",
            "started_at": "2024-01-15T10:00:00",
            "finished_at": "2024-01-15T10:01:00",
            "source_system_id": 1,
            "target_system_id": 2,
            "source_system_name": "Source",
            "target_system_name": "Target",
            "compare_mode": "except_all",
            "status": "succeeded",
        })
        assert result["ok"] is True
        assert result["id"] == 99
        # Should delete the trigger after recording
        execute_calls = mock_db.get_calls("execute")
        assert any("DELETE FROM control.triggers" in call[0] for call in execute_calls)

    async def test_returns_none_without_trigger_id(self, mock_db: MockDBSession):
        service = ValidationHistoryService(mock_db)
        result = await service.create_validation_history({})
        assert result is None

    async def test_raises_404_if_trigger_not_found(self, mock_db: MockDBSession):
        mock_db.set_fetchrow_results(None)
        service = ValidationHistoryService(mock_db)
        with pytest.raises(HTTPException) as exc_info:
            await service.create_validation_history({"trigger_id": 999})
        assert exc_info.value.status_code == 404


class TestDeleteValidationHistory:
    async def test_deletes_records(self, mock_db: MockDBSession):
        service = ValidationHistoryService(mock_db)
        result = await service.delete_validation_history([1, 2, 3])
        assert result["ok"] is True
        assert result["deleted_count"] == 3

    async def test_raises_400_for_empty_ids(self, mock_db: MockDBSession):
        service = ValidationHistoryService(mock_db)
        with pytest.raises(HTTPException) as exc_info:
            await service.delete_validation_history([])
        assert exc_info.value.status_code == 400


class TestUpdateValidationHistory:
    async def test_updates_record(self, mock_db: MockDBSession):
        mock_db.set_execute_results("UPDATE 1")
        service = ValidationHistoryService(mock_db)
        result = await service.update_validation_history(1, {"status": "failed"})
        assert result["ok"] is True
        assert "status" in result["updated_fields"]

    async def test_raises_400_for_invalid_fields(self, mock_db: MockDBSession):
        service = ValidationHistoryService(mock_db)
        with pytest.raises(HTTPException) as exc_info:
            await service.update_validation_history(1, {"invalid_field": "value"})
        assert exc_info.value.status_code == 400
