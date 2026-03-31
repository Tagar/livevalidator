from dataclasses import dataclass


@dataclass
class PartitionInfo:
    column: str
    lower: int
    upper: int

    @property
    def num_partitions(self) -> int:
        return min(12, max(4, (self.upper - self.lower) // 1_000_000))
