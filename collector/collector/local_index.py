"""Local indexing helpers for development pipelines."""

from __future__ import annotations

import json
import time
from typing import Any

import requests
from eth_utils import keccak


LOCAL_SUBMITTER = "0x0000000000000000000000000000000000000000"


def build_local_index_payload(
    *,
    bundle: dict[str, Any],
    records: list[dict[str, Any]],
    targets: list[str],
    profile: str,
    namespace: str,
    dataset_type: str,
    cid: str,
    target_spec_cid: str,
    started_at: int,
    finished_at: int,
    tool_version: str,
    vantage: str,
    dispatcher_work_id: str = "",
) -> dict[str, Any]:
    """Build the Analyst /api/submit payload from a collector bundle."""
    job_seed = json.dumps(
        {
            "targets": targets,
            "profile": profile,
            "started_at": started_at,
            "dispatcher_work_id": dispatcher_work_id,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    job_id = "0x" + keccak(text=job_seed).hex()
    uid = "local-" + job_id[2:18] + "-" + str(started_at)
    now = int(time.time())
    now_iso = iso_from_unix(now)

    return {
        "uid": uid,
        "submitter": LOCAL_SUBMITTER,
        "job_id": job_id,
        "namespace": namespace,
        "dataset_type": dataset_type,
        "cid": cid,
        "merkle_root": bundle["merkle_root"],
        "target_spec_cid": target_spec_cid,
        "started_at": started_at,
        "finished_at": finished_at,
        "tool": "nmap",
        "version": tool_version,
        "vantage": vantage,
        "manifest_sha256": bundle["manifest_sha256"],
        "extra": {
            "targets": targets,
            "profile": profile,
            "dispatcher_work_id": dispatcher_work_id,
            "source": "run-collector.sh",
        },
        "timestamp": finished_at,
        "processed_at": now_iso,
        "status": "completed",
        "error_message": "",
        "created_at": now_iso,
        "records": [build_local_record(uid, record) for record in records],
    }


def post_local_index_payload(index_url: str, payload: dict[str, Any], *, timeout: float = 30.0) -> dict[str, Any]:
    """Post a local scan payload to the Analyst submit endpoint."""
    response = requests.post(index_url, json=payload, timeout=timeout)
    response.raise_for_status()
    result = response.json()
    if not result.get("success"):
        raise RuntimeError(f"index endpoint rejected scan: {result}")
    return result


def build_local_record(submission_uid: str, record: dict[str, Any]) -> dict[str, Any]:
    return {
        "submission_uid": submission_uid,
        "timestamp": record["ts"],
        "ip": record["ip"],
        "port": record["port"],
        "protocol": record.get("proto", "tcp"),
        "state": record["state"],
        "service": record.get("service", ""),
        "product": record.get("product", ""),
        "version": record.get("version", ""),
        "banner_sha256": record.get("banner_sha256", ""),
        "cert_fpr": record.get("cert_fpr", ""),
        "tls_ja3": record.get("tls_ja3", ""),
        "latency_ms": record.get("latency_ms"),
        "tool": record.get("tool", "nmap"),
        "tool_version": record.get("tool_version", ""),
        "options": record.get("options", ""),
        "vantage": record.get("vantage", ""),
    }


def iso_from_unix(timestamp: int) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(timestamp))
