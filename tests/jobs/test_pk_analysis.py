"""Unit tests for pk_analysis.compare_pk_samples (pure Python logic)."""
import pytest
from jobs.pk_analysis import compare_pk_samples


class TestComparePkSamples:
    """Tests for the compare_pk_samples function."""
    
    def test_single_diff_column(self):
        """Single column differs between source and target."""
        src = [{"id": 1, "name": "John", "age": 30}]
        tgt = [{"id": 1, "name": "Jon", "age": 30}]
        
        result = compare_pk_samples(src, tgt, ["id"], "source_db", "target_db")
        
        assert result == [
            {"id": 1, ".system": "source_db", "name": "John"},
            {"id": 1, ".system": "target_db", "name": "Jon"},
        ]
    
    def test_multiple_diff_columns(self):
        """Multiple columns differ."""
        src = [{"id": 1, "name": "John", "age": 30, "city": "NYC"}]
        tgt = [{"id": 1, "name": "Jon", "age": 31, "city": "NYC"}]
        
        result = compare_pk_samples(src, tgt, ["id"], "src", "tgt")
        
        assert len(result) == 2
        assert result[0][".system"] == "src"
        assert result[0]["name"] == "John"
        assert result[0]["age"] == 30
        assert result[1][".system"] == "tgt"
        assert result[1]["name"] == "Jon"
        assert result[1]["age"] == 31
        # city should NOT be in output (it matches)
        assert "city" not in result[0]
        assert "city" not in result[1]
    
    def test_no_differences(self):
        """Rows are identical - output has only .system and PKs."""
        src = [{"id": 1, "name": "John"}]
        tgt = [{"id": 1, "name": "John"}]
        
        result = compare_pk_samples(src, tgt, ["id"], "src", "tgt")
        
        assert result == [
            {"id": 1, ".system": "src"},
            {"id": 1, ".system": "tgt"},
        ]
    
    def test_composite_pk(self):
        """Multi-column primary key."""
        src = [{"id": 1, "region": "US", "name": "John"}]
        tgt = [{"id": 1, "region": "US", "name": "Jon"}]
        
        result = compare_pk_samples(src, tgt, ["id", "region"], "src", "tgt")
        
        assert result[0]["id"] == 1
        assert result[0]["region"] == "US"
        assert result[0]["name"] == "John"
    
    def test_multiple_rows(self):
        """Multiple rows with differences."""
        src = [
            {"id": 1, "name": "John"},
            {"id": 2, "name": "Jane"},
        ]
        tgt = [
            {"id": 1, "name": "Jon"},
            {"id": 2, "name": "Janet"},
        ]
        
        result = compare_pk_samples(src, tgt, ["id"], "src", "tgt")
        
        # 2 rows * 2 systems = 4 output rows
        assert len(result) == 4
    
    def test_rows_sorted_by_pk(self):
        """Rows are matched by PK regardless of input order."""
        src = [
            {"id": 2, "name": "Jane"},
            {"id": 1, "name": "John"},
        ]
        tgt = [
            {"id": 1, "name": "Jon"},
            {"id": 2, "name": "Janet"},
        ]
        
        result = compare_pk_samples(src, tgt, ["id"], "src", "tgt")
        
        # First pair should be id=1
        assert result[0]["id"] == 1
        assert result[0]["name"] == "John"
        assert result[1]["id"] == 1
        assert result[1]["name"] == "Jon"
    
    def test_mismatched_row_counts_returns_none(self):
        """Different row counts returns None."""
        src = [{"id": 1, "name": "John"}]
        tgt = [
            {"id": 1, "name": "Jon"},
            {"id": 2, "name": "Jane"},
        ]
        
        result = compare_pk_samples(src, tgt, ["id"], "src", "tgt")
        
        assert result is None
    
    def test_empty_inputs(self):
        """Empty source and target returns empty list."""
        result = compare_pk_samples([], [], ["id"], "src", "tgt")
        
        assert result == []
    
    def test_null_values_differ(self):
        """None vs actual value is detected as difference."""
        src = [{"id": 1, "name": None}]
        tgt = [{"id": 1, "name": "John"}]
        
        result = compare_pk_samples(src, tgt, ["id"], "src", "tgt")
        
        assert result[0]["name"] is None
        assert result[1]["name"] == "John"
    
    def test_null_values_match(self):
        """None == None is not a difference."""
        src = [{"id": 1, "name": None, "age": 30}]
        tgt = [{"id": 1, "name": None, "age": 31}]
        
        result = compare_pk_samples(src, tgt, ["id"], "src", "tgt")
        
        # name should NOT appear (both None)
        assert "name" not in result[0]
        assert "age" in result[0]
