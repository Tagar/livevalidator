# Databricks notebook source
# MAGIC %md
# MAGIC # LiveValidator - Test Connection
# MAGIC Verifies connectivity to a system by running a lightweight probe query.

# COMMAND ----------

import sys
import os
from pyspark.sql import SparkSession
from databricks.sdk.runtime import dbutils

_nb_path = dbutils.notebook.entry_point.getDbutils().notebook().getContext().notebookPath().get()
sys.path.insert(0, "/Workspace" + os.path.dirname(_nb_path))

from backend_api_client import BackendAPIClient
from data_reader import get_connection_info
from jdbc_reader import JDBCReader

# COMMAND ----------

dbutils.widgets.text("system_name", "")
dbutils.widgets.text("backend_api_url", "")

system_name: str = dbutils.widgets.get("system_name")
backend_api_url: str = dbutils.widgets.get("backend_api_url")

if not system_name:
    raise ValueError("system_name parameter is required")

# COMMAND ----------

client = BackendAPIClient(backend_api_url=backend_api_url)
conn: dict = get_connection_info(system_name, client)
system: dict = conn["system"]
spark: SparkSession = SparkSession.getActiveSession()

print(f"Testing connection to: {system_name} (kind={system['kind']}, jdbc_method={system.get('jdbc_method', 'direct')})")

# COMMAND ----------

if conn["type"] == "catalog":
    catalog: str = conn["catalog"]
    print(f"Probing Databricks catalog: {catalog}")
    schemas = spark.sql(f"SHOW SCHEMAS IN `{catalog}`").collect()
    print(f"OK — found {len(schemas)} schema(s) in catalog '{catalog}'")

else:
    method: str = conn.get("method", "direct")
    print(f"Probing {method} connection...")
    reader = JDBCReader(conn)
    reader.query("SELECT 1 AS probe").collect()
    print(f"OK — {method} connection to '{system_name}' is reachable")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Manual Debug Snippets
# MAGIC To manually debug connectivity failures, run the relevant snippet in a notebook:
# MAGIC
# MAGIC **Databricks Catalog**
# MAGIC ```python
# MAGIC spark.sql("SHOW SCHEMAS IN `<catalog>`").show()
# MAGIC ```
# MAGIC
# MAGIC **Direct JDBC**
# MAGIC ```python
# MAGIC (spark.read.format("jdbc")
# MAGIC   .option("url", "jdbc:<type>://<host>:<port>/<database>")
# MAGIC   .option("driver", "<driver.class.Name>")
# MAGIC   .option("user", dbutils.secrets.get("<scope>", "<user-key>"))
# MAGIC   .option("password", dbutils.secrets.get("<scope>", "<pass-key>"))
# MAGIC   .option("query", "SELECT 1 AS probe")
# MAGIC   .load().show())
# MAGIC ```
# MAGIC
# MAGIC **UC JDBC Connection**
# MAGIC ```python
# MAGIC (spark.read.format("jdbc")
# MAGIC   .option("databricks.connection", "<uc-connection-name>")
# MAGIC   .option("query", "SELECT 1 AS probe")
# MAGIC   .load().show())
# MAGIC ```
# MAGIC
# MAGIC **UC Connection (Query Federation)**
# MAGIC ```python
# MAGIC spark.sql("SELECT * FROM remote_query('<uc-connection-name>', query => 'SELECT 1')").show()
# MAGIC ```