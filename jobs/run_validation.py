# Databricks notebook source
# MAGIC %md
# MAGIC # LiveValidator - Validation Workflow
# MAGIC Validates schema, row counts, and row-level differences between source and target systems.

# COMMAND ----------

import json
import requests
import traceback
from datetime import datetime, date, UTC
from decimal import Decimal
from pyspark.sql import DataFrame
from databricks.sdk import WorkspaceClient

# Initialize workspace client for auth
w: WorkspaceClient = WorkspaceClient(
    host="https://dbc-d723fd35-120a.cloud.databricks.com",
    client_id=dbutils.secrets.get(scope = "livevalidator", key = "lv-app-id"),
    client_secret=dbutils.secrets.get(scope = "livevalidator", key = "lv-app-secret")
    )

# Parse parameters
trigger_id: str | None = dbutils.widgets.get("trigger_id") or None
name: str = dbutils.widgets.get("name")
source_system_name: int = dbutils.widgets.get("source_system_name")
target_system_name: int = dbutils.widgets.get("target_system_name")
backend_api_url: str = dbutils.widgets.get("backend_api_url")
source_table: str | None = dbutils.widgets.get("source_table") or None
target_table: str | None = dbutils.widgets.get("target_table") or None
sql: str | None = dbutils.widgets.get("sql") or None
compare_mode: str = dbutils.widgets.get("compare_mode")
pk_columns: list[str] = json.loads(dbutils.widgets.get("pk_columns") or "[]")
include_columns: list[str] = json.loads(dbutils.widgets.get("include_columns") or "[]")
exclude_columns: list[str] = json.loads(dbutils.widgets.get("exclude_columns") or "[]")
options: dict = json.loads(dbutils.widgets.get("options") or "{}")

print(f"Starting: {name} (trigger_id={trigger_id or 'manual'})")

if compare_mode != "except_all":
    raise ValueError(f"Unsupported compare_mode: {compare_mode}")
# COMMAND ----------

def api_call(method: str, endpoint: str, data: dict | None = None, headers = w.config.authenticate()) -> dict:
    """Call backend API with Databricks authentication"""
    url: str = f"{backend_api_url}{endpoint}"
    response: requests.Response = requests.request(method, url, json=data, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()

def get_connection_info(system_name: str) -> dict:
    """Fetch system and prepare connection info"""
    system: dict = api_call("GET", f"/api/systems/name/{system_name}")
    
    if system["kind"] == "Databricks":
        return {"type": "catalog", "catalog": system.get("catalog"), "system": system}
    
    jdbc_str: str = system["jdbc_string"] if system["jdbc_string"] \
        else f"jdbc:{system['kind'].lower()}://{system['host']}:{system['port']}/{system['database']}"

    return {
        "type": "jdbc",
        "jdbc_string": jdbc_str,
        "username": dbutils.secrets.get("livevalidator", system["user_secret_key"]) if system.get("user_secret_key") else None,
        "password": dbutils.secrets.get("livevalidator", system["pass_secret_key"]) if system.get("pass_secret_key") else None,
        "system": system
    }    

def read_data(conn: dict, table: str | None = None, query: str | None = None) -> DataFrame:
    """Read data from system"""
    if conn["type"] == "catalog":
        if query:
            spark.sql(f"USE CATALOG `{conn['catalog']}`;")
            return spark.sql(query)
        return spark.table(f"`{conn['catalog']}`.{table}")
    
    opts: dict = {"url": conn["jdbc_string"], "user": conn["username"], "password": conn["password"]}
    if query:
        opts["query"] = query
    else:
        opts["dbtable"] = table
    
    return spark.read.format("jdbc").options(**opts).load()

def validate_schema(src_df: DataFrame, tgt_df: DataFrame, exclude: list[str]) -> dict:
    """Compare column names"""
    src_cols: set[str] = set(c for c in src_df.columns if c not in exclude)
    tgt_cols: set[str] = set(c for c in tgt_df.columns if c not in exclude)
    
    if src_cols == tgt_cols:
        print(f"\tSchema matches, {len(src_cols)} columns")
    else:
        print(f"\tSchema does not match, source: {len(src_cols)} != target: {len(tgt_cols)} columns")
    return {
        "schema_match": src_cols == tgt_cols,
        "schema_details": {
            "columns_matched": list(src_cols & tgt_cols),
            "columns_missing": list(src_cols - tgt_cols),
            "columns_extra": list(tgt_cols - src_cols)
        }
    }

def validate_counts(src_df: DataFrame, tgt_df: DataFrame) -> dict[str, int | bool]:
    """Compare row counts"""
    src_count: int = src_df.count()
    tgt_count: int = tgt_df.count()
    if src_count == tgt_count:
        print(f"\tRow counts match: {src_count}")
    else:
        print(f"\tRow counts do not match: source: {src_count} != target: {tgt_count}")
    return {
        "rows_compared": src_count if src_count == tgt_count else 0,
        "row_count_source": src_count,
        "row_count_target": tgt_count,
        "row_count_match": src_count == tgt_count
    }

def serialize_value(val):
    """Convert non-JSON-serializable objects to serializable formats"""
    match val:
        case datetime() | date():
            return val.isoformat()
        case Decimal():
            return float(val)
        case _:
            return val

def validate_rows(src_df: DataFrame, tgt_df: DataFrame, exclude: list[str]) -> dict:
    """Row-level validation using EXCEPT ALL"""
    cols: list[str] = [c for c in src_df.columns if c not in exclude]
    src_filtered: DataFrame = src_df.select(*cols)
    tgt_filtered: DataFrame = tgt_df.select(*cols)
    
    diff_count: int = src_filtered.exceptAll(tgt_filtered).count()
    if not diff_count:
        return {
            "rows_different": 0,
            "sample_differences": []
        }
    
    print(f"Found {diff_count} differences, extracting sample")

    # tgt_filtered.exceptAll(src_filtered).count() -- use this later
    sample: list = src_filtered.exceptAll(tgt_filtered).limit(5).collect()
    
    # Convert datetime/decimal objects to JSON-serializable formats
    sample_dicts: list[dict] = []
    for row in sample:
        row_dict: dict = {k: serialize_value(v) for k, v in row.asDict().items()}
        sample_dicts.append(row_dict)

    print(sample_dicts)
    
    return {
        "rows_different": diff_count,
        "sample_differences": sample_dicts
    }

# COMMAND ----------

# MAGIC %md
# MAGIC ## Main Validation Logic

# COMMAND ----------

result: dict = {
    "trigger_id": int(trigger_id) if trigger_id else None,
    "entity_type": "table" if source_table else "compare_query",
    "entity_name": name,
    "source": "manual" if not trigger_id else "schedule",
    "requested_by": "system",
    "started_at": datetime.now(UTC).isoformat(),
    "status": "succeeded",
    "source_table": source_table,
    "target_table": target_table,
    "sql_query": sql,
    "compare_mode": compare_mode,
    "pk_columns": pk_columns,
    "exclude_columns": exclude_columns
}

try:
    # Connect to systems
    src_conn: dict = get_connection_info(source_system_name)
    tgt_conn: dict = get_connection_info(target_system_name)
    
    result.update({
        "source_system_id": src_conn["system"]["id"],
        "target_system_id": tgt_conn["system"]["id"],
        "source_system_name": source_system_name,
        "target_system_name": target_system_name
    })
    
    # Read data
    print("Reading data...")
    src_df: DataFrame = read_data(src_conn, table=source_table, query=sql)
    tgt_df: DataFrame = read_data(tgt_conn, table=target_table, query=sql)
    
    # Validate
    print("Validating schema...")
    result.update(validate_schema(src_df, tgt_df, exclude_columns))
    
    print("Validating counts...")
    count_result: dict[str, int | bool] = validate_counts(src_df, tgt_df)
    result.update(count_result)
    
    # Row-level only if counts match AND compare_mode requires it
    if count_result["row_count_match"] and compare_mode == "except_all":
        print("Validating rows...")
        result.update(validate_rows(src_df, tgt_df, exclude_columns))
        result["rows_matched"] = max(result["rows_compared"] - result["rows_different"], 0)
    else:
        # Row counts don't match - skip row-level comparison (not applicable)
        result.update({"rows_compared": None, "rows_matched": None, "rows_different": None})

    # Success: row counts match AND no row differences
    if result["rows_different"] == 0:
        print(f"[SUCCESS] Validation was successful")
    else:
        rows_diff = result.get("rows_different")
        print(f"[FAILURE] Validation found differences - Schema: {result['schema_match']}, Count: {result['row_count_match']}, Diffs: {rows_diff if rows_diff is not None else 'N/A'}")
        result["status"] = "failed"

    result["finished_at"] = datetime.now(UTC).isoformat()

except Exception as e:
    error_msg: str = str(e)
    print(f"[ERROR] Unexpected failure: {traceback.format_exc()}")
    result.update({
        "status": "error",
        "error_message": str(e),
        "error_details": {"type": type(e).__name__},
        "rows_compared": None,
        "rows_matched": None,
        "rows_different": None
    })
    
    # Report failure if triggered
    if trigger_id:
        api_call("PUT", f"/api/triggers/{trigger_id}/fail", {
            "error_message": str(e),
            "error_details": {"type": type(e).__name__}
        })
    raise Exception(result["error_message"])

# COMMAND ----------

# Record results
print("Reporting results...")
api_call("POST", "/api/validation-history", result)
