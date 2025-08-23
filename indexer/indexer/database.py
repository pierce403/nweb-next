"""Database models and connection handling."""

import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy import (
    Column, String, Integer, BigInteger, DateTime, Text, Boolean,
    ForeignKey, Index, func, JSON, LargeBinary
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, AsyncEngine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import config

Base = declarative_base()


class SubmissionModel(Base):
    """Database model for scan submissions."""

    __tablename__ = "submissions"

    uid = Column(String(66), primary_key=True, index=True)  # Attestation UID
    submitter = Column(String(42), index=True)  # Ethereum address
    job_id = Column(String(66), index=True)
    namespace = Column(String(100))
    dataset_type = Column(String(50))
    cid = Column(String(100), index=True)  # IPFS CID
    merkle_root = Column(String(66))  # Merkle root hash
    target_spec_cid = Column(String(100))
    started_at = Column(BigInteger)
    finished_at = Column(BigInteger)
    tool = Column(String(50))
    version = Column(String(50))
    vantage = Column(String(100))
    manifest_sha256 = Column(String(64))
    extra = Column(LargeBinary)
    timestamp = Column(BigInteger, index=True)
    processed_at = Column(DateTime)
    status = Column(String(20), index=True, default="pending")
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    records = relationship("RecordModel", back_populates="submission", cascade="all, delete-orphan")


class RecordModel(Base):
    """Database model for individual scan records."""

    __tablename__ = "records"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    submission_uid = Column(String(66), ForeignKey("submissions.uid"), index=True)
    timestamp = Column(BigInteger, index=True)
    ip = Column(String(45), index=True)  # IPv6 ready
    port = Column(Integer, index=True)
    protocol = Column(String(10))
    state = Column(String(20))
    service = Column(String(100))
    product = Column(String(100))
    version = Column(String(200))
    banner_sha256 = Column(String(64))
    cert_fpr = Column(String(128))
    tls_ja3 = Column(String(64))
    latency_ms = Column(Integer)
    tool = Column(String(50))
    tool_version = Column(String(50))
    options = Column(String(500))
    vantage = Column(String(100))

    # Relationship back to submission
    submission = relationship("SubmissionModel", back_populates="records")


class IndexerStateModel(Base):
    """Database model for indexer state."""

    __tablename__ = "indexer_state"

    id = Column(Integer, primary_key=True)
    last_block = Column(BigInteger, default=0)
    last_attestation_uid = Column(String(66), default="")
    processed_count = Column(BigInteger, default=0)
    error_count = Column(BigInteger, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Create indexes for common queries
Index("idx_records_ip_port", RecordModel.ip, RecordModel.port)
Index("idx_records_service", RecordModel.service)
Index("idx_records_product", RecordModel.product)
Index("idx_submissions_timestamp", SubmissionModel.timestamp)
Index("idx_submissions_submitter_timestamp", SubmissionModel.submitter, SubmissionModel.timestamp)


class DatabaseManager:
    """Database connection and session management."""

    def __init__(self):
        self.engine: Optional[AsyncEngine] = None
        self.session_factory = None

    async def initialize(self):
        """Initialize database connection."""
        # Convert postgres:// to postgresql:// for SQLAlchemy
        db_url = config.postgres_url
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)

        self.engine = create_async_engine(
            db_url,
            echo=False,  # Set to True for SQL debugging
            poolclass=StaticPool,
            connect_args={
                "check_same_thread": False,
            } if "sqlite" in db_url else {},
        )

        self.session_factory = sessionmaker(
            bind=self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

        # Create tables
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def close(self):
        """Close database connection."""
        if self.engine:
            await self.engine.dispose()

    def get_session(self) -> AsyncSession:
        """Get a database session."""
        if not self.session_factory:
            raise RuntimeError("Database not initialized")
        return self.session_factory()

    async def get_or_create_state(self) -> IndexerStateModel:
        """Get or create indexer state."""
        async with self.get_session() as session:
            result = await session.execute(
                session.query(IndexerStateModel).limit(1)
            )
            state = result.scalar_one_or_none()

            if not state:
                state = IndexerStateModel()
                session.add(state)
                await session.commit()
                await session.refresh(state)

            return state

    async def update_state(self, **kwargs):
        """Update indexer state."""
        async with self.get_session() as session:
            state = await self.get_or_create_state()
            for key, value in kwargs.items():
                if hasattr(state, key):
                    setattr(state, key, value)
            await session.commit()


# Global database manager instance
db_manager = DatabaseManager()


async def init_db():
    """Initialize database connection."""
    await db_manager.initialize()


async def close_db():
    """Close database connection."""
    await db_manager.close()
