"""Main indexer service."""

import asyncio
from datetime import datetime
from typing import Optional, Set
from sqlalchemy import select
from structlog import get_logger

from .config import config
from .models import Submission
from .database import db_manager, SubmissionModel, RecordModel, IndexerStateModel
from .blockchain_watcher import BlockchainWatcher
from .ipfs_client import IPFSClient

logger = get_logger()


class IndexerService:
    """Main indexer service that coordinates all components."""

    def __init__(self):
        self.blockchain_watcher: Optional[BlockchainWatcher] = None
        self.ipfs_client: Optional[IPFSClient] = None
        self.is_running = False
        self.processed_uids: Set[str] = set()

    async def initialize(self):
        """Initialize all components."""
        logger.info("initializing_indexer")

        # Initialize database
        await db_manager.initialize()

        # Initialize IPFS client
        self.ipfs_client = IPFSClient()
        await self.ipfs_client.start()

        # Initialize blockchain watcher
        self.blockchain_watcher = BlockchainWatcher()
        await self.blockchain_watcher.initialize()
        self.blockchain_watcher.add_event_handler(self._handle_submission)

        # Load processed UIDs from database
        await self._load_processed_uids()

        logger.info("indexer_initialized")

    async def start(self):
        """Start the indexer service."""
        if self.is_running:
            logger.warning("indexer_already_running")
            return

        logger.info("starting_indexer")
        self.is_running = True

        try:
            # Get starting block from database
            start_block = await self._get_start_block()

            # Start watching blockchain
            await self.blockchain_watcher.watch_events(from_block=start_block)

        except Exception as e:
            logger.error("indexer_start_error", error=str(e))
            self.is_running = False
            raise

    async def stop(self):
        """Stop the indexer service."""
        if not self.is_running:
            return

        logger.info("stopping_indexer")
        self.is_running = False

        if self.blockchain_watcher:
            await self.blockchain_watcher.stop_watching()

        if self.ipfs_client:
            await self.ipfs_client.close()

        await db_manager.close()
        logger.info("indexer_stopped")

    async def _get_start_block(self) -> int:
        """Get the starting block number."""
        try:
            async with db_manager.get_session() as session:
                result = await session.execute(
                    select(IndexerStateModel).limit(1)
                )
                state = result.scalar_one_or_none()

                if state and state.last_block > 0:
                    # Start from the block after the last processed
                    return state.last_block + 1
                else:
                    # Start from a recent block (e.g., last 1000 blocks)
                    if self.blockchain_watcher and self.blockchain_watcher.w3:
                        current_block = await self.blockchain_watcher.w3.eth.block_number
                        return max(0, current_block - 1000)
                    return 0
        except Exception as e:
            logger.error("get_start_block_error", error=str(e))
            return 0

    async def _load_processed_uids(self):
        """Load processed attestation UIDs from database."""
        try:
            async with db_manager.get_session() as session:
                result = await session.execute(
                    select(SubmissionModel.uid)
                )
                uids = result.scalars().all()
                self.processed_uids = set(uids)
                logger.info("loaded_processed_uids", count=len(self.processed_uids))
        except Exception as e:
            logger.error("load_processed_uids_error", error=str(e))
            self.processed_uids = set()

    async def _handle_submission(self, submission: Submission):
        """Handle a new submission from the blockchain."""
        try:
            # Check if already processed
            if submission.uid in self.processed_uids:
                logger.debug("submission_already_processed", uid=submission.uid)
                return

            logger.info("processing_submission", uid=submission.uid, submitter=submission.submitter)

            # Mark as processing
            submission.status = "processing"
            await self._save_submission(submission)

            # Fetch and process the bundle
            try:
                if submission.cid:
                    bundle_data = await self.ipfs_client.fetch_bundle(submission.cid)

                    # Update submission with bundle data
                    submission.manifest = bundle_data.get("manifest")
                    submission.records = bundle_data.get("records", [])
                    submission.status = "completed"
                    submission.processed_at = datetime.utcnow()

                    # Save individual records
                    await self._save_records(submission)

                    logger.info("bundle_processed",
                              uid=submission.uid,
                              record_count=len(submission.records))

                else:
                    submission.status = "failed"
                    submission.error_message = "No CID provided"
                    logger.warning("no_cid_in_submission", uid=submission.uid)

            except Exception as e:
                submission.status = "failed"
                submission.error_message = str(e)
                logger.error("bundle_processing_error", uid=submission.uid, error=str(e))

            # Update submission in database
            await self._save_submission(submission)

            # Update processed UIDs
            self.processed_uids.add(submission.uid)

            # Update indexer state
            if self.blockchain_watcher:
                await db_manager.update_state(
                    last_attestation_uid=submission.uid,
                    processed_count=len(self.processed_uids)
                )

        except Exception as e:
            logger.error("handle_submission_error", uid=submission.uid, error=str(e))

    async def _save_submission(self, submission: Submission):
        """Save submission to database."""
        try:
            async with db_manager.get_session() as session:
                # Convert to database model
                db_submission = SubmissionModel(
                    uid=submission.uid,
                    submitter=submission.submitter,
                    job_id=submission.job_id,
                    namespace=submission.namespace,
                    dataset_type=submission.dataset_type,
                    cid=submission.cid,
                    merkle_root=submission.merkle_root,
                    target_spec_cid=submission.target_spec_cid,
                    started_at=submission.started_at,
                    finished_at=submission.finished_at,
                    tool=submission.tool,
                    version=submission.version,
                    vantage=submission.vantage,
                    manifest_sha256=submission.manifest_sha256,
                    extra=submission.extra,
                    timestamp=submission.timestamp,
                    processed_at=submission.processed_at,
                    status=submission.status,
                    error_message=submission.error_message
                )

                # Use upsert pattern
                await session.merge(db_submission)
                await session.commit()

        except Exception as e:
            logger.error("save_submission_error", uid=submission.uid, error=str(e))
            raise

    async def _save_records(self, submission: Submission):
        """Save scan records to database."""
        try:
            async with db_manager.get_session() as session:
                for record in submission.records:
                    db_record = RecordModel(
                        submission_uid=submission.uid,
                        timestamp=record.timestamp,
                        ip=record.ip,
                        port=record.port,
                        protocol=record.protocol,
                        state=record.state,
                        service=record.service,
                        product=record.product,
                        version=record.version,
                        banner_sha256=record.banner_sha256,
                        cert_fpr=record.cert_fpr,
                        tls_ja3=record.tls_ja3,
                        latency_ms=record.latency_ms,
                        tool=record.tool,
                        tool_version=record.tool_version,
                        options=record.options,
                        vantage=record.vantage
                    )
                    session.add(db_record)

                await session.commit()

        except Exception as e:
            logger.error("save_records_error", uid=submission.uid, error=str(e))
            raise

    async def get_stats(self) -> dict:
        """Get indexer statistics."""
        try:
            async with db_manager.get_session() as session:
                # Get submission counts
                result = await session.execute(
                    select(SubmissionModel.status, func.count(SubmissionModel.uid))
                    .group_by(SubmissionModel.status)
                )
                submission_stats = dict(result.all())

                # Get record count
                result = await session.execute(
                    select(func.count(RecordModel.id))
                )
                record_count = result.scalar()

                # Get indexer state
                result = await session.execute(
                    select(IndexerStateModel).limit(1)
                )
                state = result.scalar_one_or_none()

                return {
                    "submissions": submission_stats,
                    "total_records": record_count,
                    "last_block": state.last_block if state else 0,
                    "processed_count": state.processed_count if state else 0,
                    "error_count": state.error_count if state else 0,
                    "last_updated": state.updated_at.isoformat() if state else None
                }

        except Exception as e:
            logger.error("get_stats_error", error=str(e))
            return {}
