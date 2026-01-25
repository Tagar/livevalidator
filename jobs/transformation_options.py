from datetime import datetime, date
from decimal import Decimal
from typing import Any
from pyspark.sql import DataFrame
from pyspark.sql.functions import col, regexp_replace, translate

def sub_non_break_spaces(df: DataFrame) -> DataFrame:
    """Replace non-breaking spaces with regular spaces"""
    return df.select(*(
        regexp_replace(col(c.name).cast("string"), rf"[\u00A0\u2000-\u200A\u202F]", " ").alias(c.name)
        if c.dataType.typeName() == "string" else c.name
        for c in df.schema.fields 
    ))

def downgrade_unicode_symbols(df: DataFrame) -> DataFrame:
    """Replace common unicode symbols with ASCII equivalents"""
    return df.select(*(
        translate(col(c.name).cast("string"), "'（）Å", "`???").alias(c.name)
        if c.dataType.typeName() == "string" else c.name
        for c in df.schema.fields 
    ))

def sub_special_char(df: DataFrame, max_hex: str, sub_char: str, extra_replace_regex: str = "") -> DataFrame:
    """Replace characters outside allowed hex range and apply extra regex replacement"""
    df = df.select(*(
        regexp_replace(col(c.name).cast("string"), rf"[^\u0000-\u00{max_hex}]", sub_char).alias(c.name)
        if c.dataType.typeName() == "string" else c.name
        for c in df.schema.fields 
    ))

    if extra_replace_regex:
        df = df.select(*(
            regexp_replace(col(c.name).cast("string"), extra_replace_regex, sub_char).alias(c.name)
            if c.dataType.typeName() == "string" else c.name
            for c in df.schema.fields 
        ))

    return df

def drop_diacritics(df: DataFrame) -> DataFrame:
    """Drop accents, umlauts, etc: ü -> u, ñ -> n, ç -> c"""
    import pandas as pd
    from pyspark.sql.types import StringType
    from pyspark.sql.functions import pandas_udf
    import unicodedata

    @pandas_udf(StringType())
    def normalize_string_series(series: pd.Series) -> pd.Series:
        def _normalize_cell(s: str | None) -> str | None:
            if s is None:
                return None
            s = unicodedata.normalize("NFKD", s)
            return "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
        return series.apply(_normalize_cell)
    
    return df.select(*(
        normalize_string_series(col(c.name).cast("string")).alias(c.name)
        if c.dataType.typeName() == "string" else c.name
        for c in df.schema.fields 
    ))

def downgrade_unicode(df: DataFrame, replace_special_char: list[str], extra_replace_regex: str = "") -> DataFrame:
    """Apply all unicode downgrade transformations"""
    
    if len(replace_special_char) not in (0, 2):
        raise ValueError('Malformatted "replace_special_char" argument. Must be format [<max allowable hex>, <replacement char>]')

    df = sub_non_break_spaces(df)
    df = downgrade_unicode_symbols(df)
    df = drop_diacritics(df)
    if replace_special_char and len(replace_special_char) == 2:
        max_hex: str = replace_special_char[0]
        sub_char: str = replace_special_char[1]
        df = sub_special_char(df, max_hex, sub_char, extra_replace_regex)
    return df
