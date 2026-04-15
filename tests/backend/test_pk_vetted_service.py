"""Tests for pk_vetted_service."""

import pytest
from fastapi import HTTPException

from backend.services.pk_vetted_service import confirm_pk_vetted, get_pk_vetting_status
from tests.backend.conftest import MockDBSession


@pytest.mark.asyncio
class TestGetPkVettingStatus:
    async def test_returns_vetted_true(self, mock_db: MockDBSession):
        mock_db.set_fetchrow_results({"pk_vetted": True})
        result = await get_pk_vetting_status(mock_db, "table", "my.entity")
        assert result == {"pk_vetted": True}

    async def test_returns_vetted_false(self, mock_db: MockDBSession):
        mock_db.set_fetchrow_results({"pk_vetted": False})
        result = await get_pk_vetting_status(mock_db, "compare_query", "q1")
        assert result == {"pk_vetted": False}

    async def test_404(self, mock_db: MockDBSession):
        mock_db.set_fetchrow_results(None)
        with pytest.raises(HTTPException) as ei:
            await get_pk_vetting_status(mock_db, "table", "missing")
        assert ei.value.status_code == 404

    async def test_bad_entity_type(self, mock_db: MockDBSession):
        with pytest.raises(HTTPException) as ei:
            await get_pk_vetting_status(mock_db, "other", "x")
        assert ei.value.status_code == 400


@pytest.mark.asyncio
class TestConfirmPkVetted:
    async def test_sets_vetted(self, mock_db: MockDBSession):
        mock_db.set_fetchrow_results({"id": 7})
        result = await confirm_pk_vetted(mock_db, "table", "ent")
        assert result == {"ok": True}
        executes = mock_db.get_calls("execute")
        assert len(executes) == 1
        assert "pk_vetted = TRUE" in executes[0][0]

    async def test_404(self, mock_db: MockDBSession):
        mock_db.set_fetchrow_results(None)
        with pytest.raises(HTTPException) as ei:
            await confirm_pk_vetted(mock_db, "table", "missing")
        assert ei.value.status_code == 404
