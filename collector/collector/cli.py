"""Command line interface for nweb collector."""

import argparse
import json
import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from eth_utils import keccak

from .bundle import build_bundle
from .dispatcher import fetch_dispatcher_work
from .ipfs import add_directory
from .local_index import build_local_index_payload, post_local_index_payload
from .nmap import PROFILE_DATASET_TYPES, normalize_targets, parse_nmap_xml, run_nmap
from .submit import build_scan_submission_data, submit_scan


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Run nmap, build an nweb bundle, and optionally submit it.")
    parser.add_argument("--targets", default="", help="Comma-separated targets: ip:, host:, cidr:")
    parser.add_argument("--dispatcher-url", default=os.getenv("DISPATCHER_URL", ""))
    parser.add_argument("--work-id", default="", help="Select a specific dispatcher work item id")
    parser.add_argument("--work-label", default="", help="Filter dispatcher work by label")
    parser.add_argument("--random-ipv4", action="store_true", help="Ask dispatcher for random globally routable IPv4 work")
    parser.add_argument("--profile", default="")
    parser.add_argument("--namespace", default=os.getenv("NWEB_NAMESPACE", "nweb.io"))
    parser.add_argument("--vantage", default=os.getenv("NWEB_VANTAGE", "local"))
    parser.add_argument("--target-spec-cid", default="")
    parser.add_argument("--notes", default="")
    parser.add_argument("--work-dir", default="")
    parser.add_argument("--cid", default="", help="Use an existing bundle CID instead of adding to IPFS")
    parser.add_argument("--ipfs-add", action="store_true", help="Add bundle to IPFS through IPFS_API")
    parser.add_argument("--index-url", default="", help="Post completed scan to a local Analyst /api/submit endpoint")
    parser.add_argument("--no-ping", action="store_true", help="Pass -Pn to nmap and skip host discovery")
    parser.add_argument("--submit", action="store_true", help="Submit ScanSubmission attestation on-chain")
    parser.add_argument("--dry-run", action="store_true", help="Build bundle but skip IPFS and chain submission")
    args = parser.parse_args()

    dispatcher_work = None
    target_spec = args.targets
    profile = args.profile
    notes = args.notes

    if args.dispatcher_url:
        dispatcher_work = fetch_dispatcher_work(
            args.dispatcher_url,
            work_id=args.work_id,
            label=args.work_label,
            profile=args.profile,
            random="ipv4" if args.random_ipv4 else "",
        )
        target_spec = ",".join(dispatcher_work.targets)
        profile = profile or dispatcher_work.profile
        notes = notes or f"dispatcher:{dispatcher_work.id}"

    if not target_spec:
        raise SystemExit("--targets or --dispatcher-url is required")

    profile = profile or os.getenv("COLLECTOR_DEFAULT_PROFILE", "top-1000")
    targets = normalize_targets(target_spec)
    dataset_type = PROFILE_DATASET_TYPES.get(profile)
    if not dataset_type:
        raise SystemExit(f"unsupported profile {profile!r}")

    root = Path(args.work_dir) if args.work_dir else Path(tempfile.mkdtemp(prefix="nweb-collector-"))
    raw_xml = root / "nmap.xml"

    started_at, finished_at, command = run_nmap(targets, profile, raw_xml, no_ping=args.no_ping)
    records, nmap_version = parse_nmap_xml(raw_xml, vantage=args.vantage, options=" ".join(command[1:]))
    bundle = build_bundle(
        work_dir=root,
        raw_xml=raw_xml,
        records=records,
        namespace=args.namespace,
        dataset_type=dataset_type,
        target_spec_cid=args.target_spec_cid,
        tool_version=nmap_version,
        vantage=args.vantage,
        started_at=started_at,
        finished_at=finished_at,
        notes=notes,
    )

    cid = args.cid
    if args.ipfs_add and not args.dry_run:
        cid = add_directory(os.getenv("IPFS_API", "http://127.0.0.1:5001"), bundle["bundle_dir"])

    index_result = None
    if args.index_url and not args.dry_run:
        index_payload = build_local_index_payload(
            bundle=bundle,
            records=records,
            targets=targets,
            profile=profile,
            namespace=args.namespace,
            dataset_type=dataset_type,
            cid=cid,
            target_spec_cid=args.target_spec_cid,
            started_at=started_at,
            finished_at=finished_at,
            tool_version=nmap_version,
            vantage=args.vantage,
            dispatcher_work_id=dispatcher_work.id if dispatcher_work else "",
        )
        index_result = post_local_index_payload(args.index_url, index_payload)

    submit_result = None
    if args.submit and not args.dry_run:
        if not cid:
            raise SystemExit("--submit requires --ipfs-add or --cid so the attestation can include a bundle CID")
        private_key = os.getenv("PRIVATE_KEY")
        required = {
            "PRIVATE_KEY": private_key,
            "RPC_URL": os.getenv("RPC_URL"),
            "ATTESTOR_ADDRESS": os.getenv("ATTESTOR_ADDRESS"),
            "SUBMISSION_ROUTER_ADDRESS": os.getenv("SUBMISSION_ROUTER_ADDRESS"),
            "SCHEMA_UID_SCAN_SUBMISSION": os.getenv("SCHEMA_UID_SCAN_SUBMISSION"),
        }
        missing = [key for key, value in required.items() if not value or "PLACEHOLDER" in value]
        if missing:
            raise SystemExit(f"missing deployment/signing config for --submit: {', '.join(missing)}")

        from web3 import Web3

        account = Web3().eth.account.from_key(private_key)
        data = build_scan_submission_data(
            submitter=account.address,
            job_id=keccak(text=",".join(targets) + ":" + str(started_at)),
            namespace=args.namespace,
            dataset_type=dataset_type,
            cid=cid,
            merkle_root=bundle["merkle_root"],
            target_spec_cid=args.target_spec_cid,
            started_at=started_at,
            finished_at=finished_at,
            tool="nmap",
            version=nmap_version,
            vantage=args.vantage,
            manifest_sha256=bundle["manifest_sha256"],
            extra=json.dumps(
                {
                    "targets": targets,
                    "profile": profile,
                    "dispatcher_work_id": dispatcher_work.id if dispatcher_work else "",
                }
            ).encode("utf-8"),
        )
        submit_result = submit_scan(
            rpc_url=required["RPC_URL"],
            private_key=private_key,
            attestor_address=required["ATTESTOR_ADDRESS"],
            submission_router_address=required["SUBMISSION_ROUTER_ADDRESS"],
            schema_uid=required["SCHEMA_UID_SCAN_SUBMISSION"],
            data=data,
        )

    print(
        json.dumps(
            {
                "bundle_dir": str(bundle["bundle_dir"]),
                "cid": cid,
                "record_count": bundle["record_count"],
                "merkle_root": bundle["merkle_root"],
                "manifest_sha256": bundle["manifest_sha256"],
                "dataset_type": dataset_type,
                "profile": profile,
                "dispatcher_work_id": dispatcher_work.id if dispatcher_work else "",
                "nmap_version": nmap_version,
                "index": index_result,
                "submit": submit_result.__dict__ if submit_result else None,
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
