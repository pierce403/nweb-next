"""Bundle construction for nweb submissions."""

import hashlib
import json
import shutil
from pathlib import Path

from .scanprint import canonicalize_record, merkle_root


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build_bundle(
    *,
    work_dir: Path,
    raw_xml: Path,
    records: list[dict],
    namespace: str,
    dataset_type: str,
    target_spec_cid: str,
    tool_version: str,
    vantage: str,
    started_at: int,
    finished_at: int,
    notes: str = "",
) -> dict:
    """Build a UnixFS-ready bundle directory and return metadata."""
    bundle_dir = work_dir / "bundle"
    scanprint_dir = bundle_dir / "scanprint"
    raw_dir = bundle_dir / "raw"
    scanprint_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)

    bundled_xml = raw_dir / "nmap.xml"
    shutil.copyfile(raw_xml, bundled_xml)

    scanprint_path = scanprint_dir / "scanprint.v0.jsonl"
    with scanprint_path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(canonicalize_record(record))
            handle.write("\n")

    root = merkle_root(records)
    manifest = {
        "schema": "nweb.bundle.v1",
        "namespace": namespace,
        "datasetType": dataset_type,
        "scanprint": {
            "path": "scanprint/scanprint.v0.jsonl",
            "merkleRoot": root,
            "recordCount": len(records),
        },
        "artifacts": [
            {"path": "raw/nmap.xml", "sha256": sha256_file(bundled_xml)},
        ],
        "targetSpecCid": target_spec_cid,
        "tool": "nmap",
        "toolVersion": tool_version,
        "vantage": vantage,
        "startedAt": started_at,
        "finishedAt": finished_at,
        "notes": notes,
    }

    manifest_bytes = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode("utf-8")
    manifest_path = bundle_dir / "manifest.json"
    manifest_path.write_bytes(manifest_bytes + b"\n")

    return {
        "bundle_dir": bundle_dir,
        "manifest": manifest,
        "manifest_sha256": sha256_bytes(manifest_bytes),
        "merkle_root": root,
        "scanprint_path": scanprint_path,
        "record_count": len(records),
    }
