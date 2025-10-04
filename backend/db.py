import os
import ssl
import asyncpg
from dotenv import load_dotenv

# Load environment variables from .env file (for local development)
# On Databricks, environment variables are set via app.yaml
load_dotenv()

# Database connection configuration
# Local: Set in .env file
# Databricks: Set in app.yaml env section or Databricks UI
DB_DSN = os.getenv("DB_DSN")
DB_USE_SSL = os.getenv("DB_USE_SSL", "true").lower() == "true"
DB_SSL_CA_FILE = os.getenv("DB_SSL_CA_FILE", "backend/databricks-ca.pem")

# Fallback to Databricks Lakebase if DB_DSN not explicitly set
# (This is a safety fallback; production should always set DB_DSN)
if not DB_DSN:
    print("⚠️  Warning: DB_DSN not set, using hardcoded fallback")
    DB_DSN = "postgresql://apprunner:beepboop123@instance-bbdc66b7-47d1-48a0-b2bd-20992dfca609.database.cloud.databricks.com:5432/databricks_postgres"
    DB_USE_SSL = True

pool: asyncpg.Pool | None = None


def _ssl_ctx():
    """Create SSL context for secure database connections."""
    if not os.path.exists(DB_SSL_CA_FILE):
        raise FileNotFoundError(f"SSL CA file not found: {DB_SSL_CA_FILE}")
    ctx = ssl.create_default_context(purpose=ssl.Purpose.SERVER_AUTH, cafile=DB_SSL_CA_FILE)
    # leave verification ON; only disable if you know what you're doing:
    # ctx.check_hostname = False
    # ctx.verify_mode = ssl.CERT_NONE
    return ctx


async def init_pool():
    """Initialize the database connection pool."""
    global pool
    if pool is None:
        print(f"🔌 Connecting to database: {DB_DSN.split('@')[1] if '@' in DB_DSN else DB_DSN}")
        print(f"🔒 SSL enabled: {DB_USE_SSL}")
        
        if DB_USE_SSL:
            pool = await asyncpg.create_pool(dsn=DB_DSN, min_size=1, max_size=10, ssl=_ssl_ctx())
        else:
            pool = await asyncpg.create_pool(dsn=DB_DSN, min_size=1, max_size=10)
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
