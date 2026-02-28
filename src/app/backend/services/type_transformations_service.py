"""Type transformations service."""

import ast
import os
import subprocess
import tempfile
from typing import TYPE_CHECKING

from fastapi import HTTPException

if TYPE_CHECKING:
    from backend.dependencies import DBSession

from backend.default_transformations import get_default_transformation


class TypeTransformationsService:
    """Handles type transformation CRUD and Python code validation."""

    def __init__(self, db: "DBSession", user_email: str):
        self.db = db
        self.user_email = user_email

    async def list_type_transformations(self) -> list[dict]:
        """Get all type transformations with system details."""
        return await self.db.fetch("""
            SELECT
                tt.*,
                sa.name as system_a_name,
                sa.kind as system_a_kind,
                sb.name as system_b_name,
                sb.kind as system_b_kind
            FROM control.type_transformations tt
            JOIN control.systems sa ON tt.system_a_id = sa.id
            JOIN control.systems sb ON tt.system_b_id = sb.id
            ORDER BY sa.name, sb.name
        """)

    def get_default_transformation_for_system(self, system_kind: str) -> dict:
        """Get default transformation function for a system type."""
        return {"system_kind": system_kind, "function": get_default_transformation(system_kind)}

    async def get_type_transformation_for_validation(self, system_a_id: int, system_b_id: int) -> dict:
        """Get type transformation for a validation job (non-directional, with defaults)."""
        min_id = min(system_a_id, system_b_id)
        max_id = max(system_a_id, system_b_id)
        is_swapped = system_a_id != min_id

        row = await self.db.fetchrow(
            """
            SELECT
                tt.*,
                sa.name as system_a_name,
                sa.kind as system_a_kind,
                sb.name as system_b_name,
                sb.kind as system_b_kind
            FROM control.type_transformations tt
            JOIN control.systems sa ON tt.system_a_id = sa.id
            JOIN control.systems sb ON tt.system_b_id = sb.id
            WHERE tt.system_a_id = $1 AND tt.system_b_id = $2
        """,
            min_id,
            max_id,
        )

        if not row:
            sys_a = await self.db.fetchrow("SELECT name, kind FROM control.systems WHERE id = $1", system_a_id)
            sys_b = await self.db.fetchrow("SELECT name, kind FROM control.systems WHERE id = $1", system_b_id)

            return {
                "exists": False,
                "system_a_id": system_a_id,
                "system_b_id": system_b_id,
                "system_a_name": sys_a["name"] if sys_a else None,
                "system_a_kind": sys_a["kind"] if sys_a else None,
                "system_b_name": sys_b["name"] if sys_b else None,
                "system_b_kind": sys_b["kind"] if sys_b else None,
                "system_a_function": "",
                "system_b_function": "",
            }

        if is_swapped:
            system_a_func, system_b_func = row["system_b_function"], row["system_a_function"]
            system_a_name, system_b_name = row["system_b_name"], row["system_a_name"]
            system_a_kind, system_b_kind = row["system_b_kind"], row["system_a_kind"]
        else:
            system_a_func, system_b_func = row["system_a_function"], row["system_b_function"]
            system_a_name, system_b_name = row["system_a_name"], row["system_b_name"]
            system_a_kind, system_b_kind = row["system_a_kind"], row["system_b_kind"]

        return {
            "exists": True,
            "system_a_id": system_a_id,
            "system_b_id": system_b_id,
            "system_a_name": system_a_name,
            "system_a_kind": system_a_kind,
            "system_b_name": system_b_name,
            "system_b_kind": system_b_kind,
            "system_a_function": system_a_func,
            "system_b_function": system_b_func,
        }

    async def get_type_transformation(self, system_a_id: int, system_b_id: int) -> dict:
        """Get type transformation for a system pair (non-directional)."""
        system_a = min(system_a_id, system_b_id)
        system_b = max(system_a_id, system_b_id)

        row = await self.db.fetchrow(
            """
            SELECT
                tt.*,
                sa.name as system_a_name,
                sa.kind as system_a_kind,
                sb.name as system_b_name,
                sb.kind as system_b_kind
            FROM control.type_transformations tt
            JOIN control.systems sa ON tt.system_a_id = sa.id
            JOIN control.systems sb ON tt.system_b_id = sb.id
            WHERE tt.system_a_id = $1 AND tt.system_b_id = $2
        """,
            system_a,
            system_b,
        )

        if not row:
            raise HTTPException(404, "Type transformation not found for this system pair")
        return row

    async def create_type_transformation(self, data: dict) -> dict:
        """Create a new type transformation for a system pair."""
        system_a = min(data["system_a_id"], data["system_b_id"])
        system_b = max(data["system_a_id"], data["system_b_id"])

        if data["system_a_id"] == system_a:
            func_a, func_b = data["system_a_function"], data["system_b_function"]
        else:
            func_a, func_b = data["system_b_function"], data["system_a_function"]

        sys_a = await self.db.fetchrow("SELECT id, kind FROM control.systems WHERE id = $1", system_a)
        sys_b = await self.db.fetchrow("SELECT id, kind FROM control.systems WHERE id = $1", system_b)

        if not sys_a or not sys_b:
            raise HTTPException(404, "One or both systems not found")

        try:
            row = await self.db.fetchrow(
                """
                INSERT INTO control.type_transformations
                    (system_a_id, system_b_id, system_a_function, system_b_function, updated_by)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            """,
                system_a,
                system_b,
                func_a,
                func_b,
                self.user_email,
            )

            return row
        except Exception as e:
            if "unique" in str(e).lower():
                raise HTTPException(409, "Type transformation already exists for this system pair") from e
            raise

    async def update_type_transformation(self, system_a_id: int, system_b_id: int, data: dict) -> dict:
        """Update type transformation for a system pair."""
        system_a = min(system_a_id, system_b_id)
        system_b = max(system_a_id, system_b_id)
        is_swapped = system_a_id != system_a

        current = await self.db.fetchrow(
            """
            SELECT * FROM control.type_transformations
            WHERE system_a_id = $1 AND system_b_id = $2
        """,
            system_a,
            system_b,
        )

        if not current:
            raise HTTPException(404, "Type transformation not found")

        if current["version"] != data["version"]:
            raise HTTPException(409, "Version conflict - refresh and try again")

        updates = []
        params = []
        param_idx = 1

        if data.get("system_a_function") is not None:
            col = "system_b_function" if is_swapped else "system_a_function"
            updates.append(f"{col} = ${param_idx}")
            params.append(data["system_a_function"])
            param_idx += 1

        if data.get("system_b_function") is not None:
            col = "system_a_function" if is_swapped else "system_b_function"
            updates.append(f"{col} = ${param_idx}")
            params.append(data["system_b_function"])
            param_idx += 1

        updates.append(f"updated_by = ${param_idx}")
        params.append(self.user_email)
        param_idx += 1

        updates.append("updated_at = now()")
        updates.append("version = version + 1")

        params.extend([system_a, system_b])

        row = await self.db.fetchrow(
            f"""
            UPDATE control.type_transformations
            SET {", ".join(updates)}
            WHERE system_a_id = ${param_idx} AND system_b_id = ${param_idx + 1}
            RETURNING *
        """,
            *params,
        )

        return row

    async def delete_type_transformation(self, system_a_id: int, system_b_id: int) -> dict:
        """Delete type transformation for a system pair."""
        system_a = min(system_a_id, system_b_id)
        system_b = max(system_a_id, system_b_id)

        await self.db.execute(
            """
            DELETE FROM control.type_transformations
            WHERE system_a_id = $1 AND system_b_id = $2
        """,
            system_a,
            system_b,
        )

        return {"ok": True}

    def validate_python_code(self, code: str) -> dict:
        """Validate Python code syntax and type hints."""
        errors = []

        try:
            ast.parse(code)
        except SyntaxError as e:
            errors.append({"type": "syntax", "message": f"Syntax error at line {e.lineno}: {e.msg}", "line": e.lineno})
            return {"valid": False, "errors": errors}

        try:
            tree = ast.parse(code)
            functions = [node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]

            if not functions:
                errors.append(
                    {
                        "type": "structure",
                        "message": "No function definition found. Must define a function named 'transform_columns'.",
                        "line": 1,
                    }
                )
            else:
                func = functions[0]
                if func.name != "transform_columns":
                    errors.append(
                        {
                            "type": "structure",
                            "message": f"Function must be named 'transform_columns', found '{func.name}'",
                            "line": func.lineno,
                        }
                    )

                if len(func.args.args) != 2:
                    errors.append(
                        {
                            "type": "signature",
                            "message": "Function must accept exactly 2 parameters: (column_name: str, data_type: str)",
                            "line": func.lineno,
                        }
                    )
        except Exception as e:
            errors.append({"type": "validation", "message": f"Validation error: {str(e)}", "line": 1})

        if not errors:
            try:
                with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
                    f.write(code)
                    f.flush()
                    temp_path = f.name

                result = subprocess.run(
                    ["mypy", "--strict", "--no-error-summary", temp_path], capture_output=True, text=True, timeout=5
                )

                if result.returncode != 0:
                    for line in result.stdout.split("\n"):
                        if line.strip() and ":" in line:
                            parts = line.split(":", 3)
                            if len(parts) >= 4:
                                try:
                                    line_num = int(parts[1])
                                    message = parts[3].strip()
                                    errors.append({"type": "type_hint", "message": message, "line": line_num})
                                except (ValueError, IndexError):
                                    pass

                os.unlink(temp_path)
            except subprocess.TimeoutExpired:
                errors.append({"type": "timeout", "message": "Type checking timed out", "line": 1})
            except FileNotFoundError:
                pass
            except Exception:
                pass

        return {"valid": len(errors) == 0, "errors": errors}
