import os
import ssl
import asyncpg

DB_DSN = os.getenv(
    "DB_DSN",
    "postgresql://apprunner:beepboop123@instance-bbdc66b7-47d1-48a0-b2bd-20992dfca609.database.cloud.databricks.com:5432/databricks_postgres"
)

pool: asyncpg.Pool | None = None


def _ssl_ctx():
    print(os.listdir())
    ctx = ssl.create_default_context(purpose=ssl.Purpose.SERVER_AUTH, cafile="backend/databricks-ca.pem")
    # leave verification ON; only disable if you know what you're doing:
    # ctx.check_hostname = False
    # ctx.verify_mode = ssl.CERT_NONE
    return ctx


async def init_pool():
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(dsn=DB_DSN, min_size=1, max_size=10, ssl=_ssl_ctx())
    return pool


async def fetchrow(sql: str, *args):
    p = await init_pool()
    async with p.acquire() as conn:
        return await conn.fetchrow(sql, *args)


async def fetch(sql: str, *args):
    p = await init_pool()
    async with p.acquire() as conn:
        return await conn.fetch(sql, *args)


async def execute(sql: str, *args):
    p = await init_pool()
    async with p.acquire() as conn:
        return await conn.execute(sql, *args)


async def fetchval(sql: str, *args):
    p = await init_pool()
    async with p.acquire() as conn:
        return await conn.fetchval(sql, *args)
