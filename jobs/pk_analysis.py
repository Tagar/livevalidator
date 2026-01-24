from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import broadcast

def _null_safe_join(lhs: DataFrame, rhs: DataFrame, keys: list[str], how: str = "inner") -> DataFrame:
    """Join DataFrames with null-safe key comparison"""
    from pyspark.sql.functions import col, coalesce, lit
    jk: list[str] = [f"__k{i}" for i in range(len(keys))]
    null_sentinel: str = "live_validator_null_placeholder"
    
    def with_join_keys(df: DataFrame) -> DataFrame:
        nulls_replaced = [coalesce(col(k).cast("string"), lit(null_sentinel)).alias(jk[i]) for i, k in enumerate(keys)]
        return df.select("*", *nulls_replaced)

    return with_join_keys(lhs).join(with_join_keys(rhs).drop(*keys), jk, how).drop(*jk)

def run_pk_analysis(result: dict) -> dict | None:
    """
    Analyze PK mismatches and return formatted sample differences.
    
    Args:
        result: Validation result dict containing src_df, tgt_df, sample_df, 
                pk_columns, source_system_name, target_system_name
    
    Returns:
        pk_sample_differences dict or None if analysis not applicable
    """
    spark = SparkSession.getActiveSession()
    
    pk_columns: list[str] = result.get("pk_columns", [])
    src_df: DataFrame = result.get("src_df")
    tgt_df: DataFrame = result.get("tgt_df")
    sample_df: DataFrame = result.get("sample_df")
    source_system_name: str = result.get("source_system_name", "")
    target_system_name: str = result.get("target_system_name", "")
    
    if not all([src_df, tgt_df, sample_df, pk_columns]):
        return None
    
    # Get samples joined back to full rows
    src_sample: list[dict] = [r.asDict() for r in _null_safe_join(src_df, broadcast(sample_df), pk_columns).collect()]
    tgt_sample: list[dict] = [r.asDict() for r in _null_safe_join(tgt_df, broadcast(sample_df), pk_columns).collect()]
    
    if len(tgt_sample) != len(src_sample):
        print("Found inconsistencies when matching primary keys. One or more PKs may be invalid.")
        return None

    # Build formatted samples with column-level differences
    zipped_samples: zip[tuple[dict, dict]] = zip(
        sorted(src_sample, key=lambda item: [item[pk] for pk in pk_columns]),
        sorted(tgt_sample, key=lambda item: [item[pk] for pk in pk_columns])
    )

    mismatch_samples: list[dict] = [
    {**{pk: src[pk] for pk in pk_columns}, **item}
    for src, tgt in zipped_samples
    for item in [
        {".system": source_system_name, **{k: v for k, v in src.items() if v != tgt[k]}}, 
        {".system": target_system_name, **{k: tgt[k] for k, v in src.items() if v != tgt[k]}}
    ]
    ]

    if mismatch_samples:
        mismatch_df: DataFrame = spark.createDataFrame(mismatch_samples)
        mismatch_df.display()
    print(mismatch_samples)

    return {
        "mode": "primary_key",
        "pk_columns": pk_columns,
        "samples": mismatch_samples
    }
