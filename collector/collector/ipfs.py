"""IPFS helpers for Kubo HTTP API."""

import json
from pathlib import Path

import requests


def add_directory(api_url: str, directory: Path) -> str:
    """Add a directory to IPFS with canonical nweb flags and return root CID."""
    api_url = api_url.rstrip("/")
    files = []
    handles = []
    try:
        for path in sorted(directory.rglob("*")):
            if not path.is_file():
                continue
            rel = path.relative_to(directory)
            handle = path.open("rb")
            handles.append(handle)
            files.append(("file", (str(rel), handle, "application/octet-stream")))

        response = requests.post(
            f"{api_url}/api/v0/add",
            params={
                "cid-version": "1",
                "raw-leaves": "true",
                "wrap-with-directory": "true",
                "pin": "true",
            },
            files=files,
            timeout=120,
        )
        response.raise_for_status()

        root_cid = ""
        for line in response.text.strip().splitlines():
            if not line:
                continue
            item = json.loads(line)
            if item.get("Name") == "":
                root_cid = item["Hash"]

        if not root_cid:
            raise RuntimeError("IPFS add did not return a wrapped root CID")
        return root_cid
    finally:
        for handle in handles:
            handle.close()
