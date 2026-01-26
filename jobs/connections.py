import requests
from datetime import datetime, date
from decimal import Decimal
from typing import Any
from databricks.sdk import WorkspaceClient
from databricks.sdk.runtime import dbutils
from pyspark.sql import SparkSession

_w: WorkspaceClient | None = None

def _get_workspace_client() -> WorkspaceClient:
    """Lazy initialization of WorkspaceClient singleton."""
    global _w
    if _w is None:
        spark = SparkSession.getActiveSession()
        _w = WorkspaceClient(
            host=spark.conf.get('spark.databricks.workspaceUrl'),
            client_id=dbutils.secrets.get(scope="livevalidator", key="lv-app-id"),
            client_secret=dbutils.secrets.get(scope="livevalidator", key="lv-app-secret")
        )
    return _w

def _serialize_value(val: Any) -> Any:
    """Convert non-JSON-serializable objects to serializable formats."""
    match val:
        case datetime() | date():
            return val.isoformat()
        case Decimal():
            return float(val)
        case _ if hasattr(val, 'item'):  # numpy scalar
            return val.item()
        case _:
            return val

def _serialize_data(data: Any) -> Any:
    """Recursively serialize nested dicts/lists for JSON."""
    match data:
        case dict():
            return {k: _serialize_data(v) for k, v in data.items()}
        case list():
            return [_serialize_data(item) for item in data]
        case _:
            return _serialize_value(data)

def api_call(method: str, endpoint: str, data: dict | None = None) -> dict:
    """Call backend API with Databricks authentication. Reads backend_api_url from spark conf."""
    spark: SparkSession = SparkSession.getActiveSession()
    backend_api_url: str = spark.conf.get("livevalidator.backend_api_url")
    url: str = f"{backend_api_url}{endpoint}"
    headers: dict[str, str] = _get_workspace_client().config.authenticate()
    serialized_data: dict | None = _serialize_data(data) if data else None
    response: requests.Response = requests.request(method, url, json=serialized_data, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()

def get_connection_info(system_name: str) -> dict:
    """Fetch system and prepare connection info"""
    system: dict = api_call("GET", f"/api/systems/name/{system_name}")
    
    if system["kind"] == "Databricks":
        return {"type": "catalog", "catalog": system.get("catalog"), "system": system}
    
    jdbc_str: str
    if system["jdbc_string"]:
        jdbc_str = system["jdbc_string"]
    else:
        match system["kind"]:
            case "Teradata":
                jdbc_str = f"jdbc:teradata://{system['host']}"
            case "Oracle":
                jdbc_str = f"jdbc:oracle:thin:@//{system['host']}:{system['port']}/{system['database']}"
            case "SQLServer":
                jdbc_str = f"jdbc:sqlserver://{system['host']}:{system['port']};databaseName={system['database']};encrypt=true;trustServerCertificate=true"
            case _:
                jdbc_str = f"jdbc:{system['kind'].lower()}://{system['host']}:{system['port']}/{system['database']}"
        print(f"Generated {system['kind']} JDBC string: {jdbc_str}")

    scope: str = system.get("secret_scope") or "livevalidator"
    return {
        "type": "jdbc",
        "jdbc_string": jdbc_str,
        "username": dbutils.secrets.get(scope, system["user_secret_key"]) if system.get("user_secret_key") else None,
        "password": dbutils.secrets.get(scope, system["pass_secret_key"]) if system.get("pass_secret_key") else None,
        "system": system
    }
