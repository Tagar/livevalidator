"""Pytest configuration - ensures jobs/ is importable."""
import sys
from pathlib import Path

# Add project root to path so 'from jobs.pk_analysis import ...' works
sys.path.insert(0, str(Path(__file__).parent.parent))
