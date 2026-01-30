def teradata_columns(host: str, un: str, pw: str, schema: str, tbl: str) -> list[tuple[str, str]]:
    """Get column names and types from Teradata. Uses TOP 0 for full names (HELP COLUMN truncates)."""
    import teradatasql  # Lazy import - only loaded when Teradata is actually used

    schema, tbl = schema.upper(), tbl.upper()
    
    with teradatasql.connect(host=host, user=un, password=pw) as conn:
        with conn.cursor() as cur:
            # Get full column names from table metadata (HELP COLUMN truncates names)
            cur.execute(f"SELECT TOP 1 * FROM {schema}.{tbl}")
            names = [col[0] for col in cur.description]
            
            # Get types from HELP COLUMN (preserves type info)
            cur.execute(f"HELP COLUMN {schema}.{tbl}.*")
            types = [row[1].strip() for row in cur.fetchall()]
            
            return list(zip(names, types))
