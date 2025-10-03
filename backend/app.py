import os
import json
from pathlib import Path
from typing import Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.db import fetch, fetchrow, fetchval, execute

app = FastAPI(title="LiveValidator Control Plane API", version="0.1")

# Keep API isolated under /api so SPA routing can own "/"
api = APIRouter(prefix="/api")

# If frontend and API are same-origin in prod, you can tighten allow_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Schemas ----------
class DatasetIn(BaseModel):
    name: str
    src_system_id: int
    src_catalog: Optional[str] = None
    src_schema: Optional[str] = None
    src_table: Optional[str] = None
    tgt_system_id: int
    tgt_catalog: Optional[str] = None
    tgt_schema: Optional[str] = None
    tgt_table: Optional[str] = None
    compare_mode: Literal['except_all','primary_key','hash'] = 'except_all'
    pk_columns: Optional[list[str]] = None
    watermark_column: Optional[str] = None
    include_columns: list[str] = Field(default_factory=list)
    exclude_columns: list[str] = Field(default_factory=list)
    options: dict = Field(default_factory=dict)
    is_active: bool = True
    updated_by: str

class DatasetUpdate(BaseModel):
    # partial update + optimistic token
    src_system_id: Optional[int] = None
    src_catalog: Optional[str] = None
    src_schema: Optional[str] = None
    src_table: Optional[str] = None
    tgt_system_id: Optional[int] = None
    tgt_catalog: Optional[str] = None
    tgt_schema: Optional[str] = None
    tgt_table: Optional[str] = None
    compare_mode: Optional[Literal['except_all','primary_key','hash']] = None
    pk_columns: Optional[list[str]] = None
    watermark_column: Optional[str] = None
    include_columns: Optional[list[str]] = None
    exclude_columns: Optional[list[str]] = None
    options: Optional[dict] = None
    is_active: Optional[bool] = None
    updated_by: str
    version: int

class QueryIn(BaseModel):
    name: str
    src_system_id: int
    src_sql: str
    tgt_system_id: int
    tgt_sql: str
    compare_mode: Literal['except_all','primary_key','hash'] = 'except_all'
    pk_columns: Optional[list[str]] = None
    include_columns: list[str] = Field(default_factory=list)
    exclude_columns: list[str] = Field(default_factory=list)
    options: dict = Field(default_factory=dict)
    is_active: bool = True
    updated_by: str

class QueryUpdate(BaseModel):
    src_system_id: Optional[int] = None
    src_sql: Optional[str] = None
    tgt_system_id: Optional[int] = None
    tgt_sql: Optional[str] = None
    compare_mode: Optional[Literal['except_all','primary_key','hash']] = None
    pk_columns: Optional[list[str]] = None
    include_columns: Optional[list[str]] = None
    exclude_columns: Optional[list[str]] = None
    options: Optional[dict] = None
    is_active: Optional[bool] = None
    updated_by: str
    version: int

class ScheduleIn(BaseModel):
    name: str
    cron_expr: str
    timezone: str = 'UTC'
    enabled: bool = True
    max_concurrency: int = 4
    backfill_policy: Literal['none','catch_up','skip_missed'] = 'none'
    updated_by: str

class ScheduleUpdate(BaseModel):
    cron_expr: Optional[str] = None
    timezone: Optional[str] = None
    enabled: Optional[bool] = None
    max_concurrency: Optional[int] = None
    backfill_policy: Optional[Literal['none','catch_up','skip_missed']] = None
    updated_by: str
    version: int

class BindingIn(BaseModel):
    schedule_id: int
    entity_type: Literal['dataset','compare_query']
    entity_id: int

class TriggerIn(BaseModel):
    entity_type: Literal['dataset','compare_query']
    entity_id: int
    requested_by: str
    priority: int = 100
    params: dict = Field(default_factory=dict)

# ---------- Helpers ----------
async def row_or_404(sql: str, *args):
    row = await fetchrow(sql, *args)
    if not row:
        raise HTTPException(404, "not found")
    return dict(row)

# ---------- Datasets ----------
@api.get("/datasets")
async def list_datasets(q: str | None = None):
    if q:
        rows = await fetch("""
            SELECT * FROM control.datasets
            WHERE is_active AND (name ILIKE $1 OR $1 = '')
            ORDER BY name
        """, f"%{q}%")
    else:
        rows = await fetch("SELECT * FROM control.datasets WHERE is_active ORDER BY name")
    return [dict(r) for r in rows]

@api.post("/datasets")
async def create_dataset(body: DatasetIn):
    row = await fetchrow("""
        INSERT INTO control.datasets (
          name, src_system_id, src_catalog, src_schema, src_table,
          tgt_system_id, tgt_catalog, tgt_schema, tgt_table,
          compare_mode, pk_columns, watermark_column, include_columns, exclude_columns,
          options, is_active, created_by, updated_by
        ) VALUES (
          $1,$2,$3,$4,$5, $6,$7,$8,$9, $10,$11,$12,$13,$14, $15,$16,$17,$17
        ) RETURNING *
    """,
    body.name, body.src_system_id, body.src_catalog, body.src_schema, body.src_table,
    body.tgt_system_id, body.tgt_catalog, body.tgt_schema, body.tgt_table,
    body.compare_mode, body.pk_columns, body.watermark_column, body.include_columns, body.exclude_columns,
    json.dumps(body.options) if isinstance(body.options, (dict, list)) else body.options, body.is_active, body.updated_by)
    return dict(row)

@api.get("/datasets/{id}")
async def get_dataset(id: int):
    return await row_or_404("SELECT * FROM control.datasets WHERE id=$1", id)

@api.put("/datasets/{id}")
async def update_dataset(id: int, body: DatasetUpdate):
    row = await fetchrow("""
        UPDATE control.datasets SET
          src_system_id = COALESCE($2, src_system_id),
          src_catalog   = COALESCE($3, src_catalog),
          src_schema    = COALESCE($4, src_schema),
          src_table     = COALESCE($5, src_table),
          tgt_system_id = COALESCE($6, tgt_system_id),
          tgt_catalog   = COALESCE($7, tgt_catalog),
          tgt_schema    = COALESCE($8, tgt_schema),
          tgt_table     = COALESCE($9, tgt_table),
          compare_mode  = COALESCE($10, compare_mode),
          pk_columns    = COALESCE($11, pk_columns),
          watermark_column = COALESCE($12, watermark_column),
          include_columns  = COALESCE($13, include_columns),
          exclude_columns  = COALESCE($14, exclude_columns),
          options = COALESCE($15, options),
          is_active = COALESCE($16, is_active),
          updated_by = $17,
          updated_at = now(),
          version = version + 1
        WHERE id=$1 AND version=$18
        RETURNING *
    """,
    id, body.src_system_id, body.src_catalog, body.src_schema, body.src_table,
    body.tgt_system_id, body.tgt_catalog, body.tgt_schema, body.tgt_table,
    body.compare_mode, body.pk_columns, body.watermark_column, body.include_columns, body.exclude_columns,
    json.dumps(body.options) if isinstance(body.options, (dict, list)) else body.options, body.is_active, body.updated_by, body.version)
    if not row:
        current = await fetchrow("SELECT * FROM control.datasets WHERE id=$1", id)
        raise HTTPException(status_code=409, detail={"error":"version_conflict", "current": dict(current) if current else None})
    return dict(row)

@api.delete("/datasets/{id}")
async def delete_dataset(id: int):
    await execute("DELETE FROM control.datasets WHERE id=$1", id)
    return {"ok": True}

# ---------- Compare Queries ----------
@api.get("/queries")
async def list_queries(q: str | None = None):
    if q:
        rows = await fetch(
            "SELECT * FROM control.compare_queries WHERE is_active AND name ILIKE $1 ORDER BY name",
            f"%{q}%"
        )
    else:
        rows = await fetch("SELECT * FROM control.compare_queries WHERE is_active ORDER BY name")
    return [dict(r) for r in rows]

@api.post("/queries")
async def create_query(body: QueryIn):
    row = await fetchrow("""
        INSERT INTO control.compare_queries (
          name, src_system_id, src_sql, tgt_system_id, tgt_sql,
          compare_mode, pk_columns, include_columns, exclude_columns,
          options, is_active, created_by, updated_by
        ) VALUES (
          $1,$2,$3,$4,$5, $6,$7,$8,$9, $10,$11,$12,$12
        ) RETURNING *
    """,
    body.name, body.src_system_id, body.src_sql, body.tgt_system_id, body.tgt_sql,
    body.compare_mode, body.pk_columns, body.include_columns, body.exclude_columns,
    json.dumps(body.options) if isinstance(body.options, (dict, list)) else body.options, body.is_active, body.updated_by)
    return dict(row)

@api.get("/queries/{id}")
async def get_query(id: int):
    return await row_or_404("SELECT * FROM control.compare_queries WHERE id=$1", id)

@api.put("/queries/{id}")
async def update_query(id: int, body: QueryUpdate):
    row = await fetchrow("""
        UPDATE control.compare_queries SET
          src_system_id = COALESCE($2, src_system_id),
          src_sql       = COALESCE($3, src_sql),
          tgt_system_id = COALESCE($4, tgt_system_id),
          tgt_sql       = COALESCE($5, tgt_sql),
          compare_mode  = COALESCE($6, compare_mode),
          pk_columns    = COALESCE($7, pk_columns),
          include_columns = COALESCE($8, include_columns),
          exclude_columns = COALESCE($9, exclude_columns),
          options = COALESCE($10, options),
          is_active = COALESCE($11, is_active),
          updated_by = $12,
          updated_at = now(),
          version = version + 1
        WHERE id=$1 AND version=$13
        RETURNING *
    """,
    id, body.src_system_id, body.src_sql, body.tgt_system_id, body.tgt_sql,
    body.compare_mode, body.pk_columns, body.include_columns, body.exclude_columns,
    json.dumps(body.options) if isinstance(body.options, (dict, list)) else body.options, body.is_active, body.updated_by, body.version)
    if not row:
        current = await fetchrow("SELECT * FROM control.compare_queries WHERE id=$1", id)
        raise HTTPException(status_code=409, detail={"error":"version_conflict", "current": dict(current) if current else None})
    return dict(row)

@api.delete("/queries/{id}")
async def delete_query(id: int):
    await execute("DELETE FROM control.compare_queries WHERE id=$1", id)
    return {"ok": True}

# ---------- Schedules & bindings ----------
@api.get("/schedules")
async def list_schedules():
    rows = await fetch("SELECT * FROM control.schedules ORDER BY name")
    return [dict(r) for r in rows]

@api.post("/schedules")
async def create_schedule(body: ScheduleIn):
    row = await fetchrow("""
        INSERT INTO control.schedules (name, cron_expr, timezone, enabled, max_concurrency, backfill_policy, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *
    """, body.name, body.cron_expr, body.timezone, body.enabled, body.max_concurrency, body.backfill_policy, body.updated_by)
    return dict(row)

@api.put("/schedules/{id}")
async def update_schedule(id: int, body: ScheduleUpdate):
    row = await fetchrow("""
        UPDATE control.schedules SET
          cron_expr = COALESCE($2, cron_expr),
          timezone  = COALESCE($3, timezone),
          enabled   = COALESCE($4, enabled),
          max_concurrency = COALESCE($5, max_concurrency),
          backfill_policy = COALESCE($6, backfill_policy),
          updated_by = $7,
          updated_at = now(),
          version = version + 1
        WHERE id=$1 AND version=$8
        RETURNING *
    """, id, body.cron_expr, body.timezone, body.enabled, body.max_concurrency, body.backfill_policy, body.updated_by, body.version)
    if not row:
        current = await fetchrow("SELECT * FROM control.schedules WHERE id=$1", id)
        raise HTTPException(status_code=409, detail={"error":"version_conflict", "current": dict(current) if current else None})
    return dict(row)

@api.post("/bindings")
async def bind_schedule(body: BindingIn):
    id_ = await fetchval("""
        INSERT INTO control.schedule_bindings (schedule_id, entity_type, entity_id)
        VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id
    """, body.schedule_id, body.entity_type, body.entity_id)
    return {"id": id_}

@api.get("/bindings/{entity_type}/{entity_id}")
async def list_bindings(entity_type: str, entity_id: int):
    rows = await fetch("SELECT * FROM control.schedule_bindings WHERE entity_type=$1 AND entity_id=$2", entity_type, entity_id)
    return [dict(r) for r in rows]

@api.delete("/bindings/{id}")
async def delete_binding(id: int):
    await execute("DELETE FROM control.schedule_bindings WHERE id=$1", id)
    return {"ok": True}

# ---------- Trigger now ----------
@api.post("/triggers")
async def trigger_now(t: TriggerIn):
    row = await fetchrow("""
        INSERT INTO control.triggers (source, schedule_id, entity_type, entity_id, priority, requested_by, params)
        VALUES ('manual', NULL, $1, $2, $3, $4, $5)
        RETURNING *
    """, t.entity_type, t.entity_id, t.priority, t.requested_by, json.dumps(t.params) if isinstance(t.params, (dict, list)) else t.params)
    return dict(row)

# ---------- Wire API ----------
app.include_router(api)

# ---------- Robust SPA mounting (works from backend/ or anywhere) ----------
def _pick_frontend_dir() -> Optional[Path]:
    base = Path(__file__).resolve().parent
    env = os.getenv("FRONTEND_DIR")
    candidates = []

    if env:
        candidates.append(Path(env))

    # Common layouts:
    # repo/
    #   backend/app.py
    #   frontend/dist  (Vite)
    #   frontend/build (CRA)
    candidates += [
        base / ".." / "frontend" / "dist",   # Vite (sibling)
        base / ".." / "frontend" / "build",  # CRA (sibling)
        base / "frontend" / "dist",          # Vite (nested)
        base / "frontend" / "build",         # CRA (nested)
        base / ".." / "dist",                # direct sibling dist
        base / ".." / "build",               # direct sibling build
        base / "dist",
        base / "build",
    ]

    for p in candidates:
        p = p.resolve()
        if (p / "index.html").exists():
            print(f"[info] Serving SPA from: {p}")
            return p

    print("[warn] Could not find a built frontend. Looked in:")
    for p in candidates:
        print(f"  - {p}")
    return None

_FRONTEND_DIR = _pick_frontend_dir()


# --- DEBUG ONLY (remove later) -----------------------------------------------
from fastapi.responses import PlainTextResponse, JSONResponse

@app.get("/__where", response_class=PlainTextResponse)
def where():
    return f"FRONTEND_DIR = {_FRONTEND_DIR}"

@app.get("/__ls", response_class=JSONResponse)
def ls():
    base = str(_FRONTEND_DIR) if _FRONTEND_DIR else None
    def safe_list(p):
        try:
            return sorted(os.listdir(p))
        except Exception:
            return None
    return {
        "base": base,
        "has_index_html": bool(_FRONTEND_DIR and (_FRONTEND_DIR / "index.html").exists()),
        "assets_dir": str(_FRONTEND_DIR / "assets") if _FRONTEND_DIR else None,
        "assets_list": safe_list(_FRONTEND_DIR / "assets") if _FRONTEND_DIR else None,
        "static_dir": str(_FRONTEND_DIR / "static") if _FRONTEND_DIR else None,
        "static_js_list": safe_list(_FRONTEND_DIR / "static" / "js") if _FRONTEND_DIR else None,
        "static_css_list": safe_list(_FRONTEND_DIR / "static" / "css") if _FRONTEND_DIR else None,
    }

@app.get("/__index", response_class=PlainTextResponse)
def show_index():
    p = _FRONTEND_DIR / "index.html" if _FRONTEND_DIR else None
    return p.read_text(encoding="utf-8") if p and p.exists() else "index.html missing"
# -----------------------------------------------------------------------------




if _FRONTEND_DIR:
    # Serve static files (JS/CSS/assets) and index.html at "/"
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="spa")

    assets_dir = _FRONTEND_DIR / "assets"
    static_dir = _FRONTEND_DIR / "static"

    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")
        print(f"[info] Mounted /assets -> {assets_dir}")

    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
        print(f"[info] Mounted /static -> {static_dir}")

    # SPA history fallback for client-side routes (e.g., /settings, /queries/123)
    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        index_path = _FRONTEND_DIR / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
        raise HTTPException(status_code=404, detail="index.html not found")

    # Optional: silence favicon 404s if missing
    @app.get("/favicon.ico")
    def favicon():
        ico = _FRONTEND_DIR / "favicon.ico"
        return FileResponse(str(ico)) if ico.exists() else Response(status_code=204)
else:
    @app.get("/")
    def _missing_build():
        return {
            "error": "frontend_build_not_found",
            "hint": "Set FRONTEND_DIR or run `npm run build` in your frontend and place index.html under one of the common locations."
        }
