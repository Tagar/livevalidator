# Databricks notebook source
# MAGIC %md
# MAGIC # LiveValidator - Validation Workflow
# MAGIC Validates schema, row counts, and row-level differences between source and target systems.

# COMMAND ----------

import json
import requests
from datetime import datetime
from pyspark.sql import DataFrame

# Parse parameters
trigger_id: str | None = dbutils.widgets.get("trigger_id") or None
name: str = dbutils.widgets.get("name")
source_system_id: int = int(dbutils.widgets.get("source_system_id"))
target_system_id: int = int(dbutils.widgets.get("target_system_id"))
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

# COMMAND ----------

def api_call(method: str, endpoint: str, data: dict | None = None) -> dict:
    """Call backend API"""
    url: str = f"{backend_api_url}{endpoint}"
    response: requests.Response = requests.request(method, url, json=data, timeout=30)
    response.raise_for_status()
    return response.json()

def get_connection_info(system_id: int) -> dict:
    """Fetch system and prepare connection info"""
    system: dict = api_call("GET", f"/api/systems/{system_id}")
    
    if system["kind"] == "Databricks":
        return {"type": "catalog", "catalog": system.get("catalog"), "system": system}
    
    return {
        "type": "jdbc",
        "jdbc_string": system["jdbc_string"],
        "username": dbutils.secrets.get("livevalidator", system["user_secret_key"]) if system.get("user_secret_key") else None,
        "password": dbutils.secrets.get("livevalidator", system["pass_secret_key"]) if system.get("pass_secret_key") else None,
        "system": system
    }

def read_data(conn: dict, table: str | None = None, query: str | None = None) -> DataFrame:
    """Read data from system"""
    if conn["type"] == "catalog":
        if query:
            return spark.sql(query)
        return spark.table(f"{conn['catalog']}.{table}")
    
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
    return {
        "row_count_source": src_count,
        "row_count_target": tgt_count,
        "row_count_match": src_count == tgt_count
    }

def validate_rows(src_df: DataFrame, tgt_df: DataFrame, exclude: list[str]) -> dict:
    """Row-level validation using EXCEPT ALL"""
    cols: list[str] = [c for c in src_df.columns if c not in exclude]
    src_filtered: DataFrame = src_df.select(*cols)
    tgt_filtered: DataFrame = tgt_df.select(*cols)
    
    diff_count: int = src_filtered.exceptAll(tgt_filtered).count() + tgt_filtered.exceptAll(src_filtered).count()
    total: int = src_filtered.count()
    
    sample: list = src_filtered.exceptAll(tgt_filtered).limit(100).collect()
    
    return {
        "rows_compared": total,
        "rows_matched": total - diff_count,
        "rows_different": diff_count,
        "sample_differences": [row.asDict() for row in sample]
    }

# COMMAND ----------

# MAGIC %md
# MAGIC ## Main Validation Logic

# COMMAND ----------

started_at: datetime = datetime.utcnow()
result: dict = {
    "trigger_id": int(trigger_id) if trigger_id else None,
    "entity_type": "table" if source_table else "compare_query",
    "entity_name": name,
    "source": "manual" if not trigger_id else "schedule",
    "requested_by": "system",
    "requested_at": started_at.isoformat(),
    "started_at": started_at.isoformat(),
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
    src_conn: dict = get_connection_info(source_system_id)
    tgt_conn: dict = get_connection_info(target_system_id)
    
    result.update({
        "source_system_id": source_system_id,
        "target_system_id": target_system_id,
        "source_system_name": src_conn["system"]["name"],
        "target_system_name": tgt_conn["system"]["name"]
    })
    
    # Read data
    print("Reading data...")
    src_df: DataFrame = read_data(src_conn, table=source_table, query=sql)
    tgt_df: DataFrame = read_data(tgt_conn, table=target_table, query=sql)
    
    # Validate
    print("Validating schema...")
    result.update(validate_schema(src_df, tgt_df, exclude_columns))

    src_df.cache()
    tgt_df.cache()
    
    print("Validating counts...")
    count_result: dict[str, int | bool] = validate_counts(src_df, tgt_df)
    result.update(count_result)
    
    # Row-level only if counts match
    if count_result["row_count_match"] and compare_mode == "except_all":
        print("Validating rows...")
        result.update(validate_rows(src_df, tgt_df, exclude_columns))
    else:
        result.update({"rows_compared": 0, "rows_matched": 0, "rows_different": 0})
    
    src_df.unpersist()
    tgt_df.unpersist()
    
    print(f"✅ Complete - Schema: {result['schema_match']}, Count: {result['row_count_match']}, Diffs: {result.get('rows_different', 0)}")

except Exception as e:
    error_msg: str = str(e)
    print(f"❌ Failed: {error_msg}")
    result.update({
        "status": "failed",
        "error_message": str(e),
        "error_details": {"type": type(e).__name__},
        "rows_compared": 0,
        "rows_matched": 0,
        "rows_different": 0
    })
    
    # Report failure if triggered
    if trigger_id:
        try:
            api_call("PUT", f"/api/triggers/{trigger_id}/fail", {
                "error_message": str(e),
                "error_details": {"type": type(e).__name__}
            })
        except:
            pass

finally:
    # Record results
    result["finished_at"] = datetime.utcnow().isoformat()
    
    try:
        print("Reporting results...")
        api_call("POST", "/api/validation-history", result)
    except Exception as e:
        print(f"⚠️  Failed to report: {e}")
    
    if result["status"] == "failed":
        raise Exception(result["error_message"])