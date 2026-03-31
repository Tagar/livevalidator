from dataclasses import dataclass


@dataclass
class PartitionInfo:
    column: str
    lower: int
    upper: int
    num_partitions: int
