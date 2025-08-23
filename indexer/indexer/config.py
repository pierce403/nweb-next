"""Configuration management for the indexer."""

import os
from typing import Optional

from dotenv import load_dotenv
from pydantic import BaseSettings, Field

load_dotenv()


class IndexerConfig(BaseSettings):
    """Configuration settings for the indexer."""

    # Blockchain configuration
    rpc_url: str = Field(..., env="RPC_URL")
    attestor_address: str = Field(..., env="ATTESTOR_ADDRESS")
    scan_submission_schema_uid: str = Field(..., env="SCHEMA_UID_SCAN_SUBMISSION")

    # IPFS configuration
    ipfs_api: str = Field("http://127.0.0.1:5001", env="IPFS_API")
    ipfs_gateway: str = Field("http://127.0.0.1:8080", env="IPFS_GATEWAY")

    # Database configuration
    postgres_url: str = Field(..., env="POSTGRES_URL")

    # Indexer configuration
    poll_interval: int = Field(10, env="INDEXER_POLL_INTERVAL")  # seconds
    batch_size: int = Field(100, env="INDEXER_BATCH_SIZE")
    max_retries: int = Field(3, env="INDEXER_MAX_RETRIES")
    retry_delay: float = Field(1.0, env="INDEXER_RETRY_DELAY")

    # Bundle processing
    bundle_timeout: int = Field(30, env="BUNDLE_TIMEOUT")  # seconds
    max_bundle_size: int = Field(100 * 1024 * 1024, env="MAX_BUNDLE_SIZE")  # 100MB

    class Config:
        env_file = ".env"
        case_sensitive = False


# Global config instance
config = IndexerConfig()
