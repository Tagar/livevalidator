from collections.abc import Callable

from pyspark.sql import DataFrame

QueryFn = Callable[[str], DataFrame]


def _quote_column(col: str) -> str:
    return f"[{col.replace(']', ']]')}]"


def detect_partition_info(
    table: str, query_fn: QueryFn
) -> dict | None:
    """Auto-detect a partition column from SQL Server's clustered index or PK.

    Returns a dict with partition metadata, or None if no suitable column is
    found (caller falls back to single-connection read).
    """
    tbl_parts = table.split(".")
    if len(tbl_parts) == 2:
        schema, tbl = tbl_parts
    elif len(tbl_parts) == 3:
        _, schema, tbl = tbl_parts
    else:
        return None

    try:
        print("[Auto-Partition] Querying sys.indexes for partition column...")

        meta_query = f"""
        SELECT TOP 1 c.name AS col_name
        FROM sys.indexes i
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        JOIN sys.types t ON c.system_type_id = t.system_type_id
        WHERE i.object_id = OBJECT_ID('[{schema}].[{tbl}]')
          AND (i.is_primary_key = 1 OR i.type = 1)
          AND t.name IN ('int', 'bigint', 'smallint', 'tinyint')
          AND ic.key_ordinal = 1
        ORDER BY i.is_primary_key DESC, i.type ASC
        """

        rows = query_fn(meta_query).collect()
        if not rows:
            print("[Auto-Partition] No integer PK/clustered index found, reverting to single-connection read")
            return None

        partition_col = rows[0]["col_name"]
        quoted = _quote_column(partition_col)

        bounds = query_fn(
            f"SELECT MIN({quoted}) AS lo, MAX({quoted}) AS hi FROM [{schema}].[{tbl}]"
        ).collect()[0]

        if bounds["lo"] is None or bounds["hi"] is None:
            print("[Auto-Partition] No integer PK/clustered index found, reverting to single-connection read")
            return None

        lower, upper = int(bounds["lo"]), int(bounds["hi"])
        if upper - lower <= 0:
            print("[Auto-Partition] No integer PK/clustered index found, reverting to single-connection read")
            return None

        num_partitions = min(12, max(4, (upper - lower) // 1_000_000))
        print(f"[Auto-Partition] Detected column: [{partition_col}] (range: {lower:,} to {upper:,}, {num_partitions} partitions)")

        return {"column": partition_col, "lower": lower, "upper": upper, "num_partitions": num_partitions}
    except Exception as e:
        print(f"[WARN] Partition detection failed: {e}, reverting to single-connection read")
        return None
