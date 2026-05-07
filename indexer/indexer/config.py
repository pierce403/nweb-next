"""Configuration management for the indexer."""

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


class IndexerConfig(BaseSettings):
    """Configuration settings for the indexer."""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    # Blockchain configuration
    rpc_url: str = Field("https://mainnet.base.org", alias="RPC_URL")
    attestor_address: str = Field("0xATT_PLACEHOLDER", alias="ATTESTOR_ADDRESS")
    scan_submission_schema_uid: str = Field("0xSCHEMA_SUB_PLACEHOLDER", alias="SCHEMA_UID_SCAN_SUBMISSION")

    # IPFS configuration
    ipfs_api: str = Field("http://127.0.0.1:5001", alias="IPFS_API")
    ipfs_gateway: str = Field("http://127.0.0.1:8080", alias="IPFS_GATEWAY")

    # Database configuration
    postgres_url: str = Field(
        "postgresql+asyncpg://nweb:nweb@127.0.0.1:5432/nweb",
        alias="POSTGRES_URL",
    )

    # Indexer configuration
    poll_interval: int = Field(10, alias="INDEXER_POLL_INTERVAL")  # seconds
    batch_size: int = Field(100, alias="INDEXER_BATCH_SIZE")
    max_retries: int = Field(3, alias="INDEXER_MAX_RETRIES")
    retry_delay: float = Field(1.0, alias="INDEXER_RETRY_DELAY")

    # Bundle processing
    bundle_timeout: int = Field(30, alias="BUNDLE_TIMEOUT")  # seconds
    max_bundle_size: int = Field(100 * 1024 * 1024, alias="MAX_BUNDLE_SIZE")  # 100MB


# Global config instance
config = IndexerConfig()
