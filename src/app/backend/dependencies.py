"""FastAPI dependencies for dependency injection."""

from contextvars import ContextVar
from typing import Any, Protocol

from fastapi import Request

_current_user_email: ContextVar[str] = ContextVar("current_user_email", default="system")


class DBSessionProtocol(Protocol):
    """Protocol for database session - enables mocking in tests."""

    async def fetch(self, sql: str, *args: Any) -> list[dict]: ...
    async def fetchrow(self, sql: str, *args: Any) -> dict | None: ...
    async def fetchval(self, sql: str, *args: Any) -> Any: ...
    async def execute(self, sql: str, *args: Any) -> str: ...


class DBSession:
    """Real database session implementation using asyncpg pool."""

    def __init__(self, pool: Any):
        self._pool = pool

    async def fetch(self, sql: str, *args: Any) -> list[dict]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(sql, *args)
            return [dict(r) for r in rows]

    async def fetchrow(self, sql: str, *args: Any) -> dict | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(sql, *args)
            return dict(row) if row else None

    async def fetchval(self, sql: str, *args: Any) -> Any:
        async with self._pool.acquire() as conn:
            return await conn.fetchval(sql, *args)

    async def execute(self, sql: str, *args: Any) -> str:
        async with self._pool.acquire() as conn:
            return await conn.execute(sql, *args)


_db_session: DBSession | None = None


async def init_db_session() -> None:
    """Initialize the global DB session (called at startup)."""
    global _db_session
    from backend.db import init_pool

    pool = await init_pool()
    _db_session = DBSession(pool)


async def get_db() -> DBSession:
    """Dependency that returns the DB session."""
    if _db_session is None:
        await init_db_session()
    return _db_session


def get_current_user_email(request: Request) -> str:
    """Extract user email from request context (set by middleware)."""
    return _current_user_email.get()


def set_current_user_email(email: str) -> None:
    """Set the current user email in context (called by middleware)."""
    _current_user_email.set(email)


def get_user_email_from_header(request: Request) -> str:
    """Extract user email directly from request headers."""
    return request.headers.get("x-forwarded-email", "local-admin@localhost")
