"""Unit tests for sql_server_columns partition detection."""
import sys
from unittest.mock import MagicMock

# Mock pyspark before importing
sys.modules["pyspark"] = MagicMock()
sys.modules["pyspark.sql"] = MagicMock()

from jobs.sql_server_columns import sqlserver_partition_info
from jobs.models import PartitionInfo


def mock_query_fn(meta_rows, bounds):
    """Create a mock query_fn that returns meta_rows for first call, bounds for second."""
    call_count = [0]

    def query_fn(conn, query):
        mock_df = MagicMock()
        if call_count[0] == 0:
            mock_df.collect.return_value = meta_rows
        else:
            mock_df.collect.return_value = [bounds]
        call_count[0] += 1
        return mock_df

    return query_fn


class TestSqlserverPartitionInfo:
    """Tests for sqlserver_partition_info function."""

    def test_invalid_table_format_single_part(self):
        """Single-part table name returns None."""
        result = sqlserver_partition_info({}, "table", lambda c, q: None)
        assert result is None

    def test_invalid_table_format_four_parts(self):
        """Four-part table name returns None."""
        result = sqlserver_partition_info({}, "a.b.c.d", lambda c, q: None)
        assert result is None

    def test_valid_two_part_table(self):
        """Two-part table (schema.table) works."""
        query_fn = mock_query_fn(
            meta_rows=[{"col_name": "id"}],
            bounds={"lo": 1, "hi": 1000}
        )
        result = sqlserver_partition_info({}, "dbo.users", query_fn)

        assert result is not None
        assert result.column == "id"
        assert result.lower == 1
        assert result.upper == 1000

    def test_valid_three_part_table(self):
        """Three-part table (catalog.schema.table) works, catalog ignored."""
        query_fn = mock_query_fn(
            meta_rows=[{"col_name": "order_id"}],
            bounds={"lo": 0, "hi": 5_000_000}
        )
        result = sqlserver_partition_info({}, "mydb.dbo.orders", query_fn)

        assert result is not None
        assert result.column == "order_id"
        assert result.lower == 0
        assert result.upper == 5_000_000

    def test_no_pk_found_returns_none(self):
        """No rows from meta query returns None."""
        query_fn = mock_query_fn(meta_rows=[], bounds={})
        result = sqlserver_partition_info({}, "dbo.table", query_fn)
        assert result is None

    def test_null_bounds_returns_none(self):
        """Null lower bound returns None (empty table)."""
        query_fn = mock_query_fn(
            meta_rows=[{"col_name": "id"}],
            bounds={"lo": None, "hi": None}
        )
        result = sqlserver_partition_info({}, "dbo.table", query_fn)
        assert result is None

    def test_zero_range_returns_none(self):
        """upper - lower <= 0 returns None."""
        query_fn = mock_query_fn(
            meta_rows=[{"col_name": "id"}],
            bounds={"lo": 100, "hi": 100}
        )
        result = sqlserver_partition_info({}, "dbo.table", query_fn)
        assert result is None

    def test_exception_returns_none(self):
        """Exception in query_fn returns None gracefully."""
        def failing_query_fn(conn, query):
            raise Exception("Connection failed")

        result = sqlserver_partition_info({}, "dbo.table", failing_query_fn)
        assert result is None

    def test_column_with_bracket_escaped(self):
        """Column name with ] is properly escaped."""
        query_fn = mock_query_fn(
            meta_rows=[{"col_name": "weird]col"}],
            bounds={"lo": 1, "hi": 1000}
        )
        result = sqlserver_partition_info({}, "dbo.table", query_fn)

        assert result is not None
        assert result.column == "weird]col"
