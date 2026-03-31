"""Unit tests for data_reader partition functions."""
import sys
from unittest.mock import MagicMock

# Mock pyspark and databricks before importing data_reader
sys.modules["pyspark"] = MagicMock()
sys.modules["pyspark.sql"] = MagicMock()
sys.modules["databricks"] = MagicMock()
sys.modules["databricks.sdk"] = MagicMock()
sys.modules["databricks.sdk.runtime"] = MagicMock()

from jobs.models import PartitionInfo
from jobs.data_reader import add_partition_column


class TestPartitionInfo:
    """Tests for the PartitionInfo dataclass."""

    def test_num_partitions_min(self):
        """Small range gets minimum 4 partitions."""
        p = PartitionInfo("col", 0, 100)
        assert p.num_partitions == 4

    def test_num_partitions_max(self):
        """Large range caps at 12 partitions."""
        p = PartitionInfo("col", 0, 100_000_000)
        assert p.num_partitions == 12

    def test_num_partitions_scales(self):
        """Mid-range scales proportionally."""
        p = PartitionInfo("col", 0, 5_000_000)
        assert p.num_partitions == 5


class TestAddPartitionColumn:
    """Tests for the add_partition_column function."""

    def test_select_star_unchanged(self):
        """SELECT * FROM query returns unchanged, partition_info.column unchanged."""
        query = "SELECT * FROM schema.table"
        p = PartitionInfo(column="order_id", lower=1, upper=1000)

        result = add_partition_column(query, p)

        assert result == query
        assert p.column == "order_id"

    def test_explicit_columns_adds_alias(self):
        """Explicit column list adds __lv_pk__ alias."""
        query = "SELECT col1, col2 FROM schema.table"
        p = PartitionInfo(column="order_id", lower=1, upper=1000)

        result = add_partition_column(query, p)

        assert "__lv_pk__" in result
        assert "[order_id] AS __lv_pk__" in result
        assert p.column == "__lv_pk__"

    def test_case_insensitive_from(self):
        """Finds FROM regardless of case."""
        query = "select col1, col2 from schema.table"
        p = PartitionInfo(column="pk", lower=1, upper=100)

        result = add_partition_column(query, p)

        assert "[pk] AS __lv_pk__" in result
        assert p.column == "__lv_pk__"

    def test_select_star_with_where_unchanged(self):
        """SELECT * FROM with WHERE clause returns unchanged."""
        query = "SELECT * FROM schema.table WHERE created_at > '2024-01-01'"
        p = PartitionInfo(column="id", lower=1, upper=500)

        result = add_partition_column(query, p)

        assert result == query
        assert p.column == "id"

    def test_column_inserted_before_from(self):
        """Partition column is inserted right before FROM."""
        query = "SELECT a, b, c FROM mytable"
        p = PartitionInfo(column="pk", lower=0, upper=100)

        result = add_partition_column(query, p)

        assert result == "SELECT a, b, c, [pk] AS __lv_pk__ FROM mytable"
