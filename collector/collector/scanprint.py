"""scanprint v0 canonicalization and Merkle helpers."""

import hashlib
import json
from collections.abc import Iterable


def canonicalize_record(record: dict) -> str:
    """Return canonical JSON for one scanprint record."""
    return json.dumps(record, sort_keys=True, separators=(",", ":"))


def merkle_root(records: Iterable[dict]) -> str:
    """Compute the scanprint v0 Merkle root for records."""
    leaves = [hashlib.sha256(canonicalize_record(record).encode("utf-8")).digest() for record in records]
    if not leaves:
        return ""

    level = leaves
    while len(level) > 1:
        if len(level) % 2 == 1:
            level.append(level[-1])
        level = [hashlib.sha256(level[i] + level[i + 1]).digest() for i in range(0, len(level), 2)]

    return "0x" + level[0].hex()
