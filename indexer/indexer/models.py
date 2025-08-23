"""Data models for scan submissions and parsed data."""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ScanRecord(BaseModel):
    """Individual scan record from scanprint data."""

    timestamp: int = Field(..., description="Unix timestamp")
    ip: str = Field(..., description="Target IP address")
    port: int = Field(..., description="Target port")
    protocol: str = Field(..., description="Protocol (tcp/udp)")
    state: str = Field(..., description="Port state")
    service: Optional[str] = Field(None, description="Service name")
    product: Optional[str] = Field(None, description="Product name")
    version: Optional[str] = Field(None, description="Version string")
    banner_sha256: Optional[str] = Field(None, description="Banner hash")
    cert_fpr: Optional[str] = Field(None, description="Certificate fingerprint")
    tls_ja3: Optional[str] = Field(None, description="TLS JA3 fingerprint")
    latency_ms: Optional[int] = Field(None, description="Latency in milliseconds")
    tool: str = Field(..., description="Tool used")
    tool_version: str = Field(..., description="Tool version")
    options: str = Field(..., description="Tool options")
    vantage: str = Field(..., description="Scan vantage point")


class BundleManifest(BaseModel):
    """Manifest for an IPFS bundle."""

    schema: str = Field(..., description="Bundle schema version")
    namespace: str = Field(..., description="Data namespace")
    dataset_type: str = Field(..., description="Dataset type")
    scanprint: Dict[str, Any] = Field(..., description="Scanprint metadata")
    artifacts: List[Dict[str, Any]] = Field(default_factory=list, description="Bundle artifacts")
    target_spec_cid: str = Field(..., description="Target specification CID")
    tool: str = Field(..., description="Tool used")
    tool_version: str = Field(..., description="Tool version")
    vantage: str = Field(..., description="Scan vantage point")
    started_at: int = Field(..., description="Scan start timestamp")
    finished_at: int = Field(..., description="Scan end timestamp")
    notes: Optional[str] = Field(None, description="Optional notes")


class Submission(BaseModel):
    """Scan submission with blockchain and IPFS data."""

    uid: str = Field(..., description="Attestation UID")
    submitter: str = Field(..., description="Submitter address")
    job_id: str = Field(..., description="Job identifier")
    namespace: str = Field(..., description="Data namespace")
    dataset_type: str = Field(..., description="Dataset type")
    cid: str = Field(..., description="IPFS bundle CID")
    merkle_root: str = Field(..., description="Scanprint Merkle root")
    target_spec_cid: str = Field(..., description="Target spec CID")
    started_at: int = Field(..., description="Scan start timestamp")
    finished_at: int = Field(..., description="Scan end timestamp")
    tool: str = Field(..., description="Tool used")
    version: str = Field(..., description="Tool version")
    vantage: str = Field(..., description="Scan vantage point")
    manifest_sha256: str = Field(..., description="Manifest hash")
    extra: bytes = Field(default=b"", description="Extra data")
    timestamp: int = Field(..., description="Attestation timestamp")
    processed_at: Optional[datetime] = Field(None, description="Processing timestamp")
    status: str = Field("pending", description="Processing status")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    manifest: Optional[BundleManifest] = Field(None, description="Parsed manifest")
    records: List[ScanRecord] = Field(default_factory=list, description="Parsed scan records")


class IndexerState(BaseModel):
    """Indexer state tracking."""

    last_block: int = Field(0, description="Last processed block")
    last_attestation_uid: str = Field("", description="Last processed attestation UID")
    processed_count: int = Field(0, description="Total submissions processed")
    error_count: int = Field(0, description="Total errors encountered")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update")
