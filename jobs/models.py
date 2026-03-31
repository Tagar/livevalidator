from dataclasses import dataclass


@dataclass
class PartitionInfo:
    MIN_PARTITIONS = 4
    MAX_PARTITIONS = 12

    column: str
    lower: int
    upper: int

    @property
    def num_partitions(self) -> int:
        return min(self.MAX_PARTITIONS, max(self.MIN_PARTITIONS, (self.upper - self.lower) // 1_000_000))
