"""Validation configuration service."""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.dependencies import DBSession


class ValidationConfigService:
    """Handles global validation configuration."""

    def __init__(self, db: "DBSession", user_email: str = "system"):
        self.db = db
        self.user_email = user_email

    async def get_validation_config(self) -> dict:
        """Get global validation configuration."""
        row = await self.db.fetchrow("SELECT * FROM control.validation_config WHERE id = 1")
        if not row:
            return {"downgrade_unicode": False, "replace_special_char": [], "extra_replace_regex": ""}
        return row

    async def update_validation_config(self, data: dict) -> dict:
        """Update global validation configuration."""
        await self.db.execute(
            """
            UPDATE control.validation_config
            SET downgrade_unicode = $1,
                replace_special_char = $2,
                extra_replace_regex = $3,
                updated_by = $4,
                updated_at = now()
            WHERE id = 1
        """,
            data.get("downgrade_unicode", False),
            data.get("replace_special_char", []),
            data.get("extra_replace_regex", ""),
            data.get("updated_by", self.user_email),
        )

        return await self.get_validation_config()
