"""Configuration management for the indexer."""

import os
from typing import Optional

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings

load_dotenv()


class IndexerConfig(BaseSettings):
    """Configuration settings for the indexer."""

    # Blockchain configuration
    rpc_url: str = Field(..., validation_alias="RPC_URL")
    attestor_address: str = Field(..., validation_alias="ATTESTOR_ADDRESS")
    scan_submission_schema_uid: str = Field(..., validation_alias="SCHEMA_UID_SCAN_SUBMISSION")

    # IPFS configuration
    ipfs_api: str = Field("http://127.0.0.1:5001", validation_alias="IPFS_API")
    ipfs_gateway: str = Field("http://127.0.0.1:8080", validation_alias="IPFS_GATEWAY")

    # Database configuration
    postgres_url: str = Field(..., validation_alias="POSTGRES_URL")

    # Indexer configuration
    poll_interval: int = Field(10, validation_alias="INDEXER_POLL_INTERVAL")  # seconds
    batch_size: int = Field(100, validation_alias="INDEXER_BATCH_SIZE")
    max_retries: int = Field(3, validation_alias="INDEXER_MAX_RETRIES")
    retry_delay: float = Field(1.0, validation_alias="INDEXER_RETRY_DELAY")

    # Bundle processing
    bundle_timeout: int = Field(30, validation_alias="BUNDLE_TIMEOUT")  # seconds
    max_bundle_size: int = Field(100 * 1024 * 1024, validation_alias="MAX_BUNDLE_SIZE")  # 100MB

    class Config:
        env_file = ".env"
        case_sensitive = False


# Global config instance
config = IndexerConfig()
