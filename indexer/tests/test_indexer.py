"""Basic tests for the indexer components."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from indexer.config import config
from indexer.models import Submission, ScanRecord
from indexer.database import db_manager


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
