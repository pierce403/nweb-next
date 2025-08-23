"""Blockchain watcher for attestation events."""

import asyncio
from typing import List, Dict, Any, Optional, Callable
from web3 import AsyncWeb3, AsyncHTTPProvider
from web3.eth import AsyncContract
from web3.exceptions import BlockNotFound
from eth_utils import to_hex
from structlog import get_logger

from .config import config
from .models import Submission

logger = get_logger()


class BlockchainWatcher:
    """Watches blockchain for attestation events."""

    def __init__(self):
        self.w3: Optional[AsyncWeb3] = None
        self.contract: Optional[AsyncContract] = None
        self.event_handlers: List[Callable] = []
        self.is_watching = False

    async def initialize(self):
        """Initialize Web3 connection and contract."""
        self.w3 = AsyncWeb3(AsyncHTTPProvider(config.rpc_url))

        # Test connection
        try:
            latest_block = await self.w3.eth.block_number
            logger.info("blockchain_connected", latest_block=latest_block)
        except Exception as e:
            raise Exception(f"Failed to connect to blockchain: {e}")

        # Load contract ABI (simplified for now)
        # In production, this would be loaded from the compiled contract
        contract_abi = self._get_attestor_abi()

        try:
            self.contract = self.w3.eth.contract(
                address=config.attestor_address,
                abi=contract_abi
            )
            logger.info("contract_loaded", address=config.attestor_address)
        except Exception as e:
            raise Exception(f"Failed to load contract: {e}")

    def add_event_handler(self, handler: Callable):
        """Add an event handler."""
        self.event_handlers.append(handler)

    async def watch_events(self, from_block: int = 0):
        """Watch for attestation events."""
        if not self.contract:
            raise Exception("Contract not initialized")

        self.is_watching = True
        current_block = from_block

        try:
            while self.is_watching:
                try:
                    # Get latest block
                    latest_block = await self.w3.eth.block_number

                    if current_block <= latest_block:
                        # Get events for the current block range
                        events = await self._get_events_in_range(
                            current_block,
                            min(current_block + config.batch_size - 1, latest_block)
                        )

                        # Process events
                        for event in events:
                            await self._process_event(event)

                        current_block = min(current_block + config.batch_size, latest_block + 1)

                    # Wait before next poll
                    await asyncio.sleep(config.poll_interval)

                except Exception as e:
                    logger.error("watch_error", error=str(e), current_block=current_block)
                    await asyncio.sleep(config.retry_delay)

        except asyncio.CancelledError:
            logger.info("watch_cancelled")
            self.is_watching = False

    async def stop_watching(self):
        """Stop watching for events."""
        self.is_watching = False

    async def _get_events_in_range(self, from_block: int, to_block: int) -> List[Dict[str, Any]]:
        """Get attestation events in a block range."""
        try:
            # Watch for AttestationMade events
            event_filter = self.contract.events.AttestationMade.create_filter(
                from_block=from_block,
                to_block=to_block
            )

            events = await self.w3.eth.get_filter_changes(event_filter.filter_id)

            # Also check for new events using get_logs for reliability
            logs = await self.w3.eth.get_logs({
                "address": config.attestor_address,
                "fromBlock": from_block,
                "toBlock": to_block,
                "topics": [self.contract.events.AttestationMade.topic]
            })

            # Merge and deduplicate events
            all_events = []
            seen_uids = set()

            for event in events + logs:
                uid = to_hex(event.get("args", {}).get("uid", b""))
                if uid not in seen_uids:
                    all_events.append(event)
                    seen_uids.add(uid)

            return all_events

        except BlockNotFound:
            logger.warning("block_not_found", from_block=from_block, to_block=to_block)
            return []
        except Exception as e:
            logger.error("get_events_error", error=str(e), from_block=from_block, to_block=to_block)
            return []

    async def _process_event(self, event: Dict[str, Any]):
        """Process a single attestation event."""
        try:
            args = event.get("args", {})
            uid = to_hex(args.get("uid", b""))
            attester = args.get("attester")
            subject = args.get("subject")

            logger.info("attestation_event", uid=uid, attester=attester, subject=subject)

            # Get attestation data
            attestation = await self._get_attestation(uid)
            if not attestation:
                logger.warning("attestation_not_found", uid=uid)
                return

            # Check if it's a scan submission
            if attestation.get("schemaUID") == config.scan_submission_schema_uid:
                submission = await self._parse_scan_submission(uid, attestation)
                if submission:
                    # Notify event handlers
                    for handler in self.event_handlers:
                        try:
                            await handler(submission)
                        except Exception as e:
                            logger.error("handler_error", handler=str(handler), error=str(e))

        except Exception as e:
            logger.error("process_event_error", error=str(e), event=event)

    async def _get_attestation(self, uid: str) -> Optional[Dict[str, Any]]:
        """Get attestation data from contract."""
        try:
            attestation = await self.contract.functions.getAttestation(uid).call()
            return {
                "uid": to_hex(attestation[0]),
                "attester": attestation[1],
                "subject": attestation[2],
                "schemaUID": to_hex(attestation[3]),
                "timestamp": attestation[4],
                "expirationTime": attestation[5],
                "revoked": attestation[6],
                "data": attestation[7]
            }
        except Exception as e:
            logger.error("get_attestation_error", uid=uid, error=str(e))
            return None

    async def _parse_scan_submission(self, uid: str, attestation: Dict[str, Any]) -> Optional[Submission]:
        """Parse scan submission from attestation data."""
        try:
            # Decode attestation data
            # This is a simplified implementation - in production, use proper ABI decoding
            data = attestation["data"]

            # For now, create a basic submission structure
            # In production, properly decode the attestation data according to the schema
            submission = Submission(
                uid=uid,
                submitter=attestation["attester"],
                job_id="",  # Would be decoded from data
                namespace="nweb.io",
                dataset_type="nmap",
                cid="",  # Would be decoded from data
                merkle_root="",  # Would be decoded from data
                target_spec_cid="",  # Would be decoded from data
                started_at=attestation["timestamp"],
                finished_at=attestation["timestamp"],
                tool="nmap",
                version="7.95",
                vantage="",  # Would be decoded from data
                manifest_sha256="",  # Would be decoded from data
                extra=data,
                timestamp=attestation["timestamp"]
            )

            logger.info("parsed_submission", uid=uid, submitter=submission.submitter)
            return submission

        except Exception as e:
            logger.error("parse_submission_error", uid=uid, error=str(e))
            return None

    def _get_attestor_abi(self) -> List[Dict[str, Any]]:
        """Get the Attestor contract ABI."""
        # Simplified ABI - in production, this would be generated from the contract
        return [
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "name": "uid", "type": "bytes32"},
                    {"indexed": True, "name": "attester", "type": "address"},
                    {"indexed": True, "name": "subject", "type": "address"}
                ],
                "name": "AttestationMade",
                "type": "event"
            },
            {
                "inputs": [{"name": "uid", "type": "bytes32"}],
                "name": "getAttestation",
                "outputs": [
                    {"name": "", "type": "bytes32"},
                    {"name": "", "type": "address"},
                    {"name": "", "type": "address"},
                    {"name": "", "type": "bytes32"},
                    {"name": "", "type": "uint64"},
                    {"name": "", "type": "uint64"},
                    {"name": "", "type": "bool"},
                    {"name": "data", "type": "bytes"}
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ]
