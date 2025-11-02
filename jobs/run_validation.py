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
from pyspark.sql.functions import col, regexp_replace
from databricks.sdk import WorkspaceClient

# Initialize workspace client for auth
w: WorkspaceClient = WorkspaceClient(
    host="https://dbc-d723fd35-120a.cloud.databricks.com",
    client_id=dbutils.secrets.get(scope = "livevalidator", key = "lv-app-id"),
    client_secret=dbutils.secrets.get(scope = "livevalidator", key = "lv-app-secret")
    )

# COMMAND ----------

# Define parameters
dbutils.widgets.text("trigger_id", "")
dbutils.widgets.text("name", "")
dbutils.widgets.text("source_system_name", "")
dbutils.widgets.text("target_system_name", "")
dbutils.widgets.text("backend_api_url", "")
dbutils.widgets.text("source_table", "")
dbutils.widgets.text("target_table", "")
dbutils.widgets.text("sql", "")
dbutils.widgets.text("compare_mode", "except_all")
dbutils.widgets.text("pk_columns", "")
dbutils.widgets.text("include_columns", "[]")
dbutils.widgets.text("exclude_columns", "[]")
dbutils.widgets.text("downgrade_unicode", "false")
dbutils.widgets.text("replace_special_char", "[]") # ["7F","?"]
dbutils.widgets.text("extra_replace_regex", "") # \.\.\.
dbutils.widgets.text("options", "")

# COMMAND ----------

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
downgrade_unicode: bool = dbutils.widgets.get("downgrade_unicode").lower() == "true"
replace_special_char: list[str] = json.loads(dbutils.widgets.get("replace_special_char") or "[]")
extra_replace_regex: str = dbutils.widgets.get("extra_replace_regex")
options: dict = json.loads(dbutils.widgets.get("options") or "{}")

print(f"Starting: {name} (trigger_id={trigger_id or 'manual'})")

if compare_mode != "except_all":
    raise ValueError(f"Unsupported compare_mode: {compare_mode}")

if len(replace_special_char) not in (0,2):
    raise ValueError(f'Malformmatted "replace_special_char" argument. Must be format [<max allowable hex>, <replacement char>] e.g. ["7F", "?"] or ["FF", "�"]')
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

# COMMAND ----------

def serialize_value(val):
    """Convert non-JSON-serializable objects to serializable formats"""
    match val:
        case datetime() | date():
            return val.isoformat()
        case Decimal():
            return float(val)
        case _:
            return val

def drop_diacritics(df: DataFrame) -> DataFrame:
    """
    Drop accents, umlats, and others: ü -> u, ñ -> n, ç -> c, etc.
    """
    import pandas as pd
    from pyspark.sql.types import StringType
    from pyspark.sql.functions import pandas_udf
    import unicodedata

    @pandas_udf(StringType())
    def normalize_string_series(col: pd.Series) -> pd.Series:
        def _normalize_cell(s):
            if s is None:
                return None
            # Unicode NFKD decomposes characters like ü -> u + ¨
            s = unicodedata.normalize("NFKD", s)
            # Drop combining marks (category 'Mn')
            return "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
        
        return col.apply(_normalize_cell)
    
    return df.select(*(
        normalize_string_series(col(c.name).cast("string")).alias(c.name)
        if c.dataType.typeName() == "string" else c.name
        for c in df.schema.fields 
    ))

def sub_non_break_spaces(df: DataFrame) -> DataFrame:
    return df.select(*(
        regexp_replace(col(c.name).cast("string"), f"[\u00A0\u2007\u202F]", " ").alias(c.name)
        if c.dataType.typeName() == "string" else c.name
        for c in df.schema.fields 
    ))

def downgrade_unicode_symbols(df: DataFrame) -> DataFrame:
    df = df.select(*(
        regexp_replace(col(c.name).cast("string"), f"[\u2018]", "`").alias(c.name)
        if c.dataType.typeName() == "string" else c.name
        for c in df.schema.fields 
    ))

    return df

def sub_special_char(df: DataFrame, max_hex: str, sub_char: str, extra_replace_regex: str = extra_replace_regex) -> DataFrame:
    df = df.select(*(
        regexp_replace(col(c.name).cast("string"), f"[^\\x00-\\x{max_hex}]", sub_char).alias(c.name)
        if c.dataType.typeName() == "string" else c.name
        for c in df.schema.fields 
    ))

    df = df.select(*(
        regexp_replace(col(c.name).cast("string"), extra_replace_regex, sub_char).alias(c.name)
        if c.dataType.typeName() == "string" else c.name
        for c in df.schema.fields 
    ))

    return df

def _downgrade_unicode(df: DataFrame):
    df = sub_non_break_spaces(df)
    df = downgrade_unicode_symbols(df)
    df = drop_diacritics(df)
    _max_hex, _sub_char = replace_special_char
    df = sub_special_char(df, _max_hex, _sub_char)
    return df

def validate_rows(src_df: DataFrame, tgt_df: DataFrame, exclude: list[str]) -> dict:
    """Row-level validation using EXCEPT ALL"""
    cols: list[str] = [c for c in src_df.columns if c not in exclude]
    src_filtered: DataFrame = src_df.select(*cols)
    tgt_filtered: DataFrame = tgt_df.select(*cols)
    
    diff_df: DataFrame = src_filtered.exceptAll(tgt_filtered)
    diff_count: int = diff_df.count()
    if not diff_count:
        return {
            "rows_different": 0,
            "sample_differences": []
        }

    if downgrade_unicode:
        print(f"Found {str(diff_count)} mis-matches, trying again with unicode downgraded...")
        src_filtered = _downgrade_unicode(src_filtered)
        tgt_filtered = _downgrade_unicode(tgt_filtered)
        diff_df: DataFrame = src_filtered.exceptAll(tgt_filtered)

        diff_count: int = diff_df.count()
        if not diff_count:
            return {
                "rows_different": 0,
                "sample_differences": []
            }
    
    print(f"Found {diff_count} differences, extracting sample")

    # tgt_filtered.exceptAll(src_filtered).count() -- use this later
    sample: list = diff_df.limit(10).collect()
    
    # Convert datetime/decimal objects to JSON-serializable formats
    sample_dicts: list[dict] = []
    for row in sample:
        row_dict: dict = {k: serialize_value(v) for k, v in row.asDict().items()}
        sample_dicts.append(row_dict)

    print("\n\n".join(str(row) for row in sample_dicts))
    
    return {
        "rows_different": diff_count,
        "sample_differences": sample_dicts,
        "src_df": src_filtered,
        "tgt_df": tgt_filtered
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
            "status": result["status"],
            "error_message": str(e),
            "error_details": {"type": type(e).__name__}
        })
    raise Exception(result["error_message"])

# COMMAND ----------

# Record results
print("Reporting results...")

serde_result: dict = result.copy()
if serde_result.get('src_df'):
    serde_result.pop('src_df')
    serde_result.pop('tgt_df')
api_call("POST", "/api/validation-history", serde_result)
