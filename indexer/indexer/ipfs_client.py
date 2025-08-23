"""IPFS client for fetching and verifying bundles."""

import asyncio
import hashlib
import json
from typing import Dict, Any, Optional, List
import aiohttp
import ujson
from structlog import get_logger

from .config import config
from .models import BundleManifest, ScanRecord

logger = get_logger()


class IPFSClient:
    """Client for interacting with IPFS."""

    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.api_url = config.ipfs_api.rstrip("/")
        self.gateway_url = config.ipfs_gateway.rstrip("/")

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def start(self):
        """Initialize HTTP session."""
        if not self.session:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=config.bundle_timeout)
            )

    async def close(self):
        """Close HTTP session."""
        if self.session:
            await self.session.close()
            self.session = None

    async def pin_add(self, cid: str) -> bool:
        """Pin a CID to local IPFS node."""
        try:
            async with self.session.post(
                f"{self.api_url}/api/v0/pin/add",
                params={"arg": cid}
            ) as response:
                if response.status == 200:
                    logger.info("pinned_cid", cid=cid)
                    return True
                else:
                    logger.error("pin_failed", cid=cid, status=response.status)
                    return False
        except Exception as e:
            logger.error("pin_error", cid=cid, error=str(e))
            return False

    async def cat(self, cid: str, max_size: int = None) -> bytes:
        """Fetch content from IPFS."""
        if max_size is None:
            max_size = config.max_bundle_size

        try:
            async with self.session.post(
                f"{self.api_url}/api/v0/cat",
                params={"arg": cid}
            ) as response:
                if response.status == 200:
                    content = await response.read()
                    if len(content) > max_size:
                        raise ValueError(f"Content too large: {len(content)} > {max_size}")
                    return content
                else:
                    raise Exception(f"IPFS cat failed: {response.status}")
        except Exception as e:
            logger.error("ipfs_cat_error", cid=cid, error=str(e))
            raise

    async def stat(self, cid: str) -> Dict[str, Any]:
        """Get stats for a CID."""
        try:
            async with self.session.post(
                f"{self.api_url}/api/v0/object/stat",
                params={"arg": cid}
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    raise Exception(f"IPFS stat failed: {response.status}")
        except Exception as e:
            logger.error("ipfs_stat_error", cid=cid, error=str(e))
            raise

    async def fetch_bundle(self, cid: str) -> Dict[str, Any]:
        """Fetch and parse a complete bundle."""
        try:
            # First, get the bundle directory structure
            stat = await self.stat(cid)
            if stat.get("NumLinks", 0) == 0:
                raise ValueError("Bundle CID is not a directory")

            bundle_data = {}

            # Fetch manifest.json
            try:
                manifest_bytes = await self.cat(f"{cid}/manifest.json")
                manifest_data = ujson.loads(manifest_bytes.decode("utf-8"))
                bundle_data["manifest"] = BundleManifest(**manifest_data)
            except Exception as e:
                logger.error("manifest_fetch_error", cid=cid, error=str(e))
                raise ValueError(f"Failed to fetch manifest: {e}")

            # Fetch scanprint data
            try:
                scanprint_path = bundle_data["manifest"].scanprint["path"]
                scanprint_bytes = await self.cat(f"{cid}/{scanprint_path}")
                scanprint_data = scanprint_bytes.decode("utf-8")

                # Parse JSONL format
                records = []
                for line in scanprint_data.strip().split("\n"):
                    if line:
                        record_data = ujson.loads(line)
                        records.append(ScanRecord(**record_data))
                bundle_data["records"] = records
            except Exception as e:
                logger.error("scanprint_fetch_error", cid=cid, error=str(e))
                raise ValueError(f"Failed to fetch scanprint: {e}")

            # Verify Merkle root if provided
            if bundle_data["manifest"].scanprint.get("merkleRoot"):
                expected_root = bundle_data["manifest"].scanprint["merkleRoot"]
                actual_root = self._compute_scanprint_merkle_root(scanprint_data)
                if expected_root != actual_root:
                    raise ValueError(f"Merkle root mismatch: expected {expected_root}, got {actual_root}")

            # Optionally fetch raw nmap XML if present
            try:
                for artifact in bundle_data["manifest"].artifacts:
                    if artifact["path"].endswith("nmap.xml"):
                        xml_bytes = await self.cat(f"{cid}/{artifact['path']}")
                        bundle_data["nmap_xml"] = xml_bytes.decode("utf-8")
                        break
            except Exception as e:
                logger.warning("nmap_xml_fetch_warning", cid=cid, error=str(e))
                # Don't fail if nmap.xml is missing

            return bundle_data

        except Exception as e:
            logger.error("bundle_fetch_error", cid=cid, error=str(e))
            raise

    def _compute_scanprint_merkle_root(self, scanprint_data: str) -> str:
        """Compute Merkle root for scanprint data."""
        # Simple implementation - in production, use proper Merkle tree
        lines = [line.strip() for line in scanprint_data.strip().split("\n") if line.strip()]
        if not lines:
            return ""

        # For now, just hash the entire content
        # In production, implement proper canonical JSON serialization + Merkle tree
        canonical_data = "\n".join(lines).encode("utf-8")
        return f"0x{hashlib.sha256(canonical_data).hexdigest()}"

    async def check_availability(self, cid: str, gateways: List[str] = None) -> Dict[str, Any]:
        """Check availability across multiple gateways."""
        if gateways is None:
            gateways = [self.gateway_url, "https://gateway.pinata.cloud"]

        results = {}
        for gateway in gateways:
            try:
                timeout = aiohttp.ClientTimeout(total=10)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.get(f"{gateway}/ipfs/{cid}") as response:
                        results[gateway] = {
                            "available": response.status == 200,
                            "status": response.status,
                            "size": len(await response.read())
                        }
            except Exception as e:
                results[gateway] = {
                    "available": False,
                    "error": str(e)
                }

        total_gateways = len(gateways)
        available_gateways = sum(1 for r in results.values() if r.get("available", False))

        return {
            "cid": cid,
            "total_gateways": total_gateways,
            "available_gateways": available_gateways,
            "availability": available_gateways / total_gateways if total_gateways > 0 else 0,
            "gateway_results": results
        }
