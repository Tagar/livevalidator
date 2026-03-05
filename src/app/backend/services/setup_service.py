"""Setup and database initialization service."""

from pathlib import Path
from typing import TYPE_CHECKING

from fastapi import HTTPException

if TYPE_CHECKING:
    from backend.dependencies import DBSession


class SetupService:
    """Handles database initialization and reset."""

    def __init__(self, db: "DBSession"):
        self.db = db
        self.sql_dir = Path(__file__).resolve().parent.parent / "sql"

    async def initialize_database(self) -> dict:
        """Initial setup: Creates schema and tables from DDL (safe, idempotent)."""
        ddl_file = self.sql_dir / "ddl.sql"
        grants_file = self.sql_dir / "grants.sql"

        if not ddl_file.exists():
            raise HTTPException(status_code=500, detail=f"DDL file not found: {ddl_file}")

        ddl_sql = ddl_file.read_text()
        grants_sql = grants_file.read_text() if grants_file.exists() else ""

        try:
            await self.db.execute(ddl_sql)

            if grants_sql:
                try:
                    await self.db.execute(grants_sql)
                except Exception as e:
                    print(f"[warn] Grants failed (might be ok in local dev): {e}")

            return {"ok": True, "message": "Database initialized successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database initialization failed: {str(e)}") from e

    async def reset_database(self) -> dict:
        """DESTRUCTIVE: Drops all tables and recreates them from DDL."""
        drop_tables_file = self.sql_dir / "drop_tables.sql"
        ddl_file = self.sql_dir / "ddl.sql"

        if not drop_tables_file.exists():
            raise HTTPException(status_code=500, detail=f"Drop tables file not found: {drop_tables_file}")
        if not ddl_file.exists():
            raise HTTPException(status_code=500, detail=f"DDL file not found: {ddl_file}")

        drop_tables_sql = drop_tables_file.read_text()
        ddl_sql = ddl_file.read_text()

        try:
            await self.db.execute(drop_tables_sql)
            await self.db.execute(ddl_sql)

            return {"ok": True, "message": "Database reset successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database reset failed: {str(e)}") from e
