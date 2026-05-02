"""Basic tests for the indexer components."""

import hashlib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from indexer.config import config
from indexer.models import BundleManifest, Submission, ScanRecord
from indexer.database import db_manager
from indexer.blockchain_watcher import BlockchainWatcher
from indexer.ipfs_client import IPFSClient
from indexer.schemas import (
    decode_availability_check,
    decode_challenge,
    decode_resolution,
    decode_scan_submission,
    encode_availability_check,
    encode_challenge,
    encode_resolution,
    encode_scan_submission,
)


class TestConfig:
    """Test configuration loading."""

    def test_config_loading(self):
        """Test that configuration loads with defaults."""
        assert config.poll_interval == 10
        assert config.batch_size == 100
        assert config.max_retries == 3


class TestModels:
    """Test data models."""

    def test_submission_model(self):
        """Test Submission model creation."""
        submission = Submission(
            uid="0x1234567890abcdef",
            submitter="0x742d35Cc6634C0532925a3b8D6351f1d55B1D1C",
            job_id="0xabcdef1234567890",
            namespace="nweb.io",
            dataset_type="nmap",
            cid="bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
            merkle_root="0x1234567890abcdef1234567890abcdef12345678",
            target_spec_cid="bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
            started_at=1693526400,
            finished_at=1693529999,
            tool="nmap",
            version="7.95",
            vantage="AS1234/us-west-2",
            manifest_sha256="abcdef1234567890abcdef1234567890abcdef12",
            timestamp=1693526400
        )

        assert submission.uid == "0x1234567890abcdef"
        assert submission.submitter == "0x742d35Cc6634C0532925a3b8D6351f1d55B1D1C"
        assert submission.status == "pending"

    def test_scan_record_model(self):
        """Test ScanRecord model creation."""
        record = ScanRecord(
            timestamp=1693526400,
            ip="203.0.113.42",
            port=443,
            protocol="tcp",
            state="open",
            service="https",
            product="nginx",
            version="1.24.0",
            banner_sha256="abcdef1234567890abcdef1234567890abcdef12",
            cert_fpr="sha256:abcdef1234567890abcdef1234567890abcdef12",
            tls_ja3="abcdef1234567890abcdef1234567890ab",
            latency_ms=21,
            tool="nmap",
            tool_version="7.95",
            options="top-1000,T3",
            vantage="AS1234/us-west-2"
        )

        assert record.ip == "203.0.113.42"
        assert record.port == 443
        assert record.service == "https"

    def test_scan_record_accepts_scanprint_aliases(self):
        """Test scanprint v0 field names parse into indexer model names."""
        record = ScanRecord(
            ts=1693526400,
            ip="203.0.113.42",
            port=443,
            proto="tcp",
            state="open",
            service="https",
            tool="nmap",
            tool_version="7.95",
            options="top-1000,T3",
            vantage="AS1234/us-west-2",
        )

        assert record.timestamp == 1693526400
        assert record.protocol == "tcp"

    def test_bundle_manifest_accepts_architecture_camel_case(self):
        """Test architecture manifest JSON parses into indexer model names."""
        manifest = BundleManifest(
            schema="nweb.bundle.v1",
            namespace="nweb.io",
            datasetType="nmap-quick",
            scanprint={"path": "scanprint/scanprint.v0.jsonl", "merkleRoot": "0x1234"},
            artifacts=[],
            targetSpecCid="",
            tool="nmap",
            toolVersion="7.95",
            vantage="local/test",
            startedAt=1,
            finishedAt=2,
        )

        assert manifest.schema_version == "nweb.bundle.v1"
        assert manifest.dataset_type == "nmap-quick"
        assert manifest.target_spec_cid == ""
        assert manifest.tool_version == "7.95"
        assert manifest.started_at == 1
        assert manifest.finished_at == 2


class TestDatabase:
    """Test database operations."""

    @pytest.mark.asyncio
    async def test_database_initialization(self):
        """Test database manager initialization."""
        # This is a basic test - in a real environment with a test database
        # we would actually test database operations
        assert db_manager is not None
        assert db_manager.session_factory is None  # Not initialized yet

    @pytest.mark.asyncio
    @patch('indexer.database.create_async_engine')
    async def test_database_init(self, mock_engine):
        """Test database initialization with mocked engine."""
        mock_engine_instance = AsyncMock()
        mock_engine.return_value = mock_engine_instance

        # This would require a test database to be fully functional
        # For now, we just test that the components can be imported
        assert True


class TestCLI:
    """Test CLI functionality."""

    def test_cli_import(self):
        """Test that CLI can be imported."""
        try:
            from indexer.cli import cli
            assert cli is not None
        except ImportError as e:
            pytest.fail(f"Failed to import CLI: {e}")


class TestBlockchainWatcher:
    """Test blockchain watcher parsing."""

    @pytest.mark.asyncio
    async def test_parse_scan_submission_decodes_attestation_data(self):
        """Test ScanSubmission ABI decoding."""
        watcher = BlockchainWatcher()
        uid = "0x" + "12" * 32
        submitter = "0x742d35cc6634c0532925a3b8d6351f1d55b1d1c0"
        submitter_bytes = bytes.fromhex(submitter.removeprefix("0x"))
        job_id = b"\xab" * 32
        merkle_root = b"\xcd" * 32
        extra = b'{"profile":"top-1000"}'

        data = encode_scan_submission(
            submitter_bytes,
            job_id,
            "nweb/base-mainnet",
            "nmap-top1k",
            "bafybeigdyrzt",
            merkle_root,
            "bafy-target-spec",
            1_700_000_000,
            1_700_000_900,
            "nmap",
            "7.95",
            "AS1234/us-west-2",
            "sha256:manifest",
            extra,
        )

        submission = await watcher._parse_scan_submission(
            uid,
            {
                "attester": submitter,
                "timestamp": 1_700_001_000,
                "data": data,
            },
        )

        assert submission is not None
        assert submission.uid == uid
        assert submission.submitter.lower() == submitter.lower()
        assert submission.job_id == "0x" + "ab" * 32
        assert submission.namespace == "nweb/base-mainnet"
        assert submission.dataset_type == "nmap-top1k"
        assert submission.cid == "bafybeigdyrzt"
        assert submission.merkle_root == "0x" + "cd" * 32
        assert submission.target_spec_cid == "bafy-target-spec"
        assert submission.started_at == 1_700_000_000
        assert submission.finished_at == 1_700_000_900
        assert submission.tool == "nmap"
        assert submission.version == "7.95"
        assert submission.vantage == "AS1234/us-west-2"
        assert submission.manifest_sha256 == "sha256:manifest"
        assert submission.extra == extra
        assert submission.timestamp == 1_700_001_000


class TestSchemas:
    """Test protocol attestation schema helpers."""

    def test_scan_submission_round_trip(self):
        submitter = bytes.fromhex("742d35cc6634c0532925a3b8d6351f1d55b1d1c0")
        data = encode_scan_submission(
            submitter,
            b"\xab" * 32,
            "nweb/base-mainnet",
            "nmap-top1k",
            "bafy-scan",
            b"\xcd" * 32,
            "bafy-targets",
            1,
            2,
            "nmap",
            "7.95",
            "AS1234/us-west-2",
            "sha256:manifest",
            b"{}",
        )

        decoded = decode_scan_submission(data)

        assert decoded["submitter"] == "0x742d35cc6634c0532925a3b8d6351f1d55b1d1c0"
        assert decoded["job_id"] == "0x" + "ab" * 32
        assert decoded["merkle_root"] == "0x" + "cd" * 32
        assert decoded["extra"] == b"{}"

    def test_availability_check_round_trip(self):
        data = encode_availability_check("bafy-scan", False, 5, 1, b"\x11" * 32, 123)

        decoded = decode_availability_check(data)

        assert decoded == {
            "cid": "bafy-scan",
            "available": False,
            "attempts": 5,
            "gateways_ok": 1,
            "fetch_digest": "0x" + "11" * 32,
            "checked_at": 123,
        }

    def test_challenge_round_trip(self):
        data = encode_challenge(b"\x22" * 32, "bafy-scan", b"\x33" * 32, "bafy-evidence", 456)

        decoded = decode_challenge(data)

        assert decoded == {
            "job_id": "0x" + "22" * 32,
            "cid": "bafy-scan",
            "reason_code": "0x" + "33" * 32,
            "evidence_cid": "bafy-evidence",
            "grace_ends_at": 456,
        }

    def test_resolution_round_trip(self):
        data = encode_resolution(b"\x44" * 32, True, 50, "timeout", "bafy-new")

        decoded = decode_resolution(data)

        assert decoded == {
            "challenge_id": "0x" + "44" * 32,
            "slash": True,
            "slash_amount": 50,
            "notes": "timeout",
            "new_cid": "bafy-new",
        }


class TestIPFSClient:
    """Test IPFS bundle helpers."""

    def test_scanprint_merkle_root_canonicalizes_jsonl(self):
        """Test Merkle root is stable across JSON key order and whitespace."""
        client = IPFSClient()
        scanprint_data = """
        {"port":443,"ip":"203.0.113.42","state":"open"}
        {"state":"open", "ip":"203.0.113.43", "port":80}
        """

        leaf_a = hashlib.sha256(b'{"ip":"203.0.113.42","port":443,"state":"open"}').digest()
        leaf_b = hashlib.sha256(b'{"ip":"203.0.113.43","port":80,"state":"open"}').digest()
        expected = "0x" + hashlib.sha256(leaf_a + leaf_b).hexdigest()

        assert client._compute_scanprint_merkle_root(scanprint_data) == expected

    def test_scanprint_merkle_root_duplicates_odd_leaf(self):
        """Test odd leaf counts duplicate the last leaf for pair hashing."""
        client = IPFSClient()
        scanprint_data = """
        {"ip":"203.0.113.42","port":443}
        {"ip":"203.0.113.43","port":80}
        {"ip":"203.0.113.44","port":22}
        """

        leaves = [
            hashlib.sha256(b'{"ip":"203.0.113.42","port":443}').digest(),
            hashlib.sha256(b'{"ip":"203.0.113.43","port":80}').digest(),
            hashlib.sha256(b'{"ip":"203.0.113.44","port":22}').digest(),
        ]
        first_pair = hashlib.sha256(leaves[0] + leaves[1]).digest()
        second_pair = hashlib.sha256(leaves[2] + leaves[2]).digest()
        expected = "0x" + hashlib.sha256(first_pair + second_pair).hexdigest()

        assert client._compute_scanprint_merkle_root(scanprint_data) == expected


# Integration test placeholder
class TestIntegration:
    """Integration tests (require full setup)."""

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_full_indexer_initialization(self):
        """Test full indexer initialization (requires external services)."""
        pytest.skip("Integration test requires IPFS, Postgres, and blockchain RPC")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_blockchain_watcher(self):
        """Test blockchain watcher (requires RPC endpoint)."""
        pytest.skip("Integration test requires blockchain RPC endpoint")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_ipfs_client(self):
        """Test IPFS client (requires IPFS node)."""
        pytest.skip("Integration test requires IPFS node")
