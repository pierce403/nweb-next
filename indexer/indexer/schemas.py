"""ABI schemas and helpers for nweb protocol attestations."""

from typing import Any

from eth_abi import decode, encode
from eth_utils import to_hex

SCAN_SUBMISSION_ABI_TYPES = (
    "address",
    "bytes32",
    "string",
    "string",
    "string",
    "bytes32",
    "string",
    "uint64",
    "uint64",
    "string",
    "string",
    "string",
    "string",
    "bytes",
)

AVAILABILITY_CHECK_ABI_TYPES = (
    "string",
    "bool",
    "uint8",
    "uint8",
    "bytes32",
    "uint64",
)

CHALLENGE_ABI_TYPES = (
    "bytes32",
    "string",
    "bytes32",
    "string",
    "uint64",
)

RESOLUTION_ABI_TYPES = (
    "bytes32",
    "bool",
    "uint256",
    "string",
    "string",
)


def normalize_abi_data(data: bytes | str) -> bytes:
    """Normalize bytes or 0x-prefixed hex data into bytes."""
    if isinstance(data, str):
        return bytes.fromhex(data.removeprefix("0x"))
    return data


def encode_scan_submission(*values: Any) -> bytes:
    return encode(SCAN_SUBMISSION_ABI_TYPES, values)


def decode_scan_submission(data: bytes | str) -> dict[str, Any]:
    (
        submitter,
        job_id,
        namespace,
        dataset_type,
        cid,
        merkle_root,
        target_spec_cid,
        started_at,
        finished_at,
        tool,
        version,
        vantage,
        manifest_sha256,
        extra,
    ) = decode(SCAN_SUBMISSION_ABI_TYPES, normalize_abi_data(data))

    return {
        "submitter": submitter,
        "job_id": to_hex(job_id),
        "namespace": namespace,
        "dataset_type": dataset_type,
        "cid": cid,
        "merkle_root": to_hex(merkle_root),
        "target_spec_cid": target_spec_cid,
        "started_at": started_at,
        "finished_at": finished_at,
        "tool": tool,
        "version": version,
        "vantage": vantage,
        "manifest_sha256": manifest_sha256,
        "extra": extra,
    }


def encode_availability_check(*values: Any) -> bytes:
    return encode(AVAILABILITY_CHECK_ABI_TYPES, values)


def decode_availability_check(data: bytes | str) -> dict[str, Any]:
    cid, available, attempts, gateways_ok, fetch_digest, checked_at = decode(
        AVAILABILITY_CHECK_ABI_TYPES,
        normalize_abi_data(data),
    )
    return {
        "cid": cid,
        "available": available,
        "attempts": attempts,
        "gateways_ok": gateways_ok,
        "fetch_digest": to_hex(fetch_digest),
        "checked_at": checked_at,
    }


def encode_challenge(*values: Any) -> bytes:
    return encode(CHALLENGE_ABI_TYPES, values)


def decode_challenge(data: bytes | str) -> dict[str, Any]:
    job_id, cid, reason_code, evidence_cid, grace_ends_at = decode(
        CHALLENGE_ABI_TYPES,
        normalize_abi_data(data),
    )
    return {
        "job_id": to_hex(job_id),
        "cid": cid,
        "reason_code": to_hex(reason_code),
        "evidence_cid": evidence_cid,
        "grace_ends_at": grace_ends_at,
    }


def encode_resolution(*values: Any) -> bytes:
    return encode(RESOLUTION_ABI_TYPES, values)


def decode_resolution(data: bytes | str) -> dict[str, Any]:
    challenge_id, slash, slash_amount, notes, new_cid = decode(
        RESOLUTION_ABI_TYPES,
        normalize_abi_data(data),
    )
    return {
        "challenge_id": to_hex(challenge_id),
        "slash": slash,
        "slash_amount": slash_amount,
        "notes": notes,
        "new_cid": new_cid,
    }
