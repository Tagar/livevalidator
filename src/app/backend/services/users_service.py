"""User and permissions service."""

from typing import TYPE_CHECKING

from fastapi import HTTPException

if TYPE_CHECKING:
    from backend.dependencies import DBSession


class UsersService:
    """Handles user roles, permissions, and access control."""

    def __init__(self, db: "DBSession"):
        self.db = db

    async def get_default_user_role(self) -> str:
        """Get the default user role from app config."""
        row = await self.db.fetchrow("SELECT value FROM control.app_config WHERE key = 'default_user_role'")
        return row["value"] if row else "CAN_MANAGE"

    async def ensure_user_exists(self, email: str) -> None:
        """Ensure user exists in user_roles table, create with default role if not."""
        exists = await self.db.fetchrow("SELECT 1 FROM control.user_roles WHERE user_email = $1", email)
        if not exists:
            default_role = await self.get_default_user_role()
            await self.db.execute(
                """
                INSERT INTO control.user_roles (user_email, role, assigned_by, assigned_at)
                VALUES ($1, $2, 'system', NOW())
                ON CONFLICT (user_email) DO NOTHING
            """,
                email,
                default_role,
            )

    async def get_user_role(self, email: str) -> str:
        """Get user role, uses default from config if user not in table."""
        row = await self.db.fetchrow("SELECT role FROM control.user_roles WHERE user_email = $1", email)
        if row:
            return row["role"]
        return await self.get_default_user_role()

    async def can_edit_object(self, email: str, object_type: str, object_id: int) -> bool:
        """
        Check if user can edit specific object based on their role and ownership.

        Rules:
        - CAN_VIEW: Cannot edit anything
        - CAN_RUN: Can edit tables/queries/schedules they created
        - CAN_EDIT: Can edit any table/query/schedule (but not systems/type_transformations)
        - CAN_MANAGE: Can edit everything
        """
        role = await self.get_user_role(email)

        if role == "CAN_VIEW":
            return False

        if role == "CAN_MANAGE":
            return True

        if role == "CAN_EDIT":
            return object_type in ["tables", "queries", "schedules"]

        if role == "CAN_RUN":
            if object_type not in ["tables", "queries", "schedules"]:
                return False

            table_map = {"tables": "datasets", "queries": "compare_queries", "schedules": "schedules"}
            db_table = table_map.get(object_type)
            if not db_table:
                return False

            row = await self.db.fetchrow(f"SELECT created_by FROM control.{db_table} WHERE id = $1", object_id)
            return row and row["created_by"] == email

        return False

    async def require_role(self, email: str, *allowed_roles: str) -> None:
        """Check if user has one of the allowed roles, raise 403 if not."""
        role = await self.get_user_role(email)
        if role not in allowed_roles:
            raise HTTPException(
                403,
                f"Access denied. This action requires one of these roles: {', '.join(allowed_roles)}. Your role: {role}",
            )

    async def get_current_user_info(self, email: str) -> dict:
        """Get current user's email and role."""
        role = await self.get_user_role(email)
        return {"email": email, "role": role}

    async def list_users(self) -> list[dict]:
        """List all users and their assigned roles."""
        rows = await self.db.fetch("""
            SELECT user_email, role
            FROM control.user_roles
            ORDER BY user_email ASC
        """)
        return rows

    async def set_user_role(self, user_email: str, role: str, admin_email: str) -> dict:
        """Set or update a user's role."""
        valid_roles = ["CAN_VIEW", "CAN_RUN", "CAN_EDIT", "CAN_MANAGE"]
        if role not in valid_roles:
            raise HTTPException(400, f"Invalid role. Must be one of: {', '.join(valid_roles)}")

        await self.db.execute(
            """
            UPDATE control.user_roles
            SET role = $2, assigned_by = $3, assigned_at = NOW()
            WHERE user_email = $1
        """,
            user_email,
            role,
            admin_email,
        )

        return {"user_email": user_email, "role": role}

    async def delete_user_role(self, user_email: str) -> dict:
        """Remove user's role assignment (reverts to default)."""
        await self.db.execute("DELETE FROM control.user_roles WHERE user_email = $1", user_email)
        return {"user_email": user_email, "message": "Role removed, user will now have default role"}

    async def get_app_config(self) -> list[dict]:
        """Get all application configuration."""
        return await self.db.fetch("SELECT key, value, description FROM control.app_config ORDER BY key")

    async def update_app_config(self, key: str, value: str, admin_email: str) -> dict:
        """Update a specific config value."""
        if key == "default_user_role":
            valid_roles = ["CAN_VIEW", "CAN_RUN", "CAN_EDIT", "CAN_MANAGE"]
            if value not in valid_roles:
                raise HTTPException(400, f"Invalid role. Must be one of: {', '.join(valid_roles)}")

        await self.db.execute(
            """
            UPDATE control.app_config
            SET value = $2, updated_by = $3, updated_at = NOW()
            WHERE key = $1
        """,
            key,
            value,
            admin_email,
        )

        return {"key": key, "value": value}
