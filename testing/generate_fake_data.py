#!/usr/bin/env python3
"""
nweb Analyst - Fake Data Generator
Generates realistic test data for the PGLite database
"""

import asyncio
import json
import hashlib
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any
import uuid
from faker import Faker
import ipaddress

# Use aiosqlite for database operations
try:
    import aiosqlite
    import sqlite3
    SQLITE_AVAILABLE = True
except ImportError:
    SQLITE_AVAILABLE = False
    print("⚠️  SQLite not available. Install with: pip install aiosqlite")

# Initialize Faker
fake = Faker()

# Common network services and their ports
COMMON_SERVICES = {
    22: "ssh",
    23: "telnet",
    25: "smtp",
    53: "dns",
    80: "http",
    110: "pop3",
    143: "imap",
    443: "https",
    993: "imaps",
    995: "pop3s",
    3306: "mysql",
    5432: "postgresql",
    8080: "http-alt",
    8443: "https-alt"
}

# Dataset types
DATASET_TYPES = ["nmap-full", "nmap-top-1000", "nmap-top-100", "masscan"]

# Tools and versions
TOOLS = [
    ("nmap", "7.94"),
    ("masscan", "1.3.2"),
    ("zmap", "2.1.1"),
    ("rustscan", "2.1.1")
]

class FakeDataGenerator:
    def __init__(self, db_path: str = "./nweb-analyst.db"):
        self.db_path = db_path
        self.db = None

    async def init_db(self):
        """Initialize the database connection"""
        if not SQLITE_AVAILABLE:
            raise ImportError("SQLite is not available. Install with: pip install aiosqlite")

        # Create database connection
        self.db = await aiosqlite.connect(self.db_path)

        # Enable foreign keys
        await self.db.execute("PRAGMA foreign_keys = ON")

        await self.create_tables()

    async def create_tables(self):
        """Create database tables"""
        # Create submissions table
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS submissions (
                uid TEXT PRIMARY KEY,
                submitter TEXT NOT NULL,
                job_id TEXT NOT NULL,
                namespace TEXT NOT NULL,
                dataset_type TEXT NOT NULL,
                cid TEXT NOT NULL,
                merkle_root TEXT NOT NULL,
                target_spec_cid TEXT NOT NULL,
                started_at INTEGER NOT NULL,
                finished_at INTEGER NOT NULL,
                tool TEXT NOT NULL,
                version TEXT NOT NULL,
                vantage TEXT NOT NULL,
                manifest_sha256 TEXT NOT NULL,
                extra BLOB NOT NULL,
                timestamp INTEGER NOT NULL,
                processed_at TEXT NULL,
                status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
                error_message TEXT NULL,
                created_at TEXT NOT NULL
            )
        """)

        # Create records table
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                submission_uid TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                ip TEXT NOT NULL,
                port INTEGER NOT NULL,
                protocol TEXT NOT NULL,
                state TEXT NOT NULL,
                service TEXT NULL,
                product TEXT NULL,
                version TEXT NULL,
                banner_sha256 TEXT NULL,
                cert_fpr TEXT NULL,
                tls_ja3 TEXT NULL,
                latency_ms INTEGER NULL,
                tool TEXT NOT NULL,
                tool_version TEXT NOT NULL,
                options TEXT NOT NULL,
                vantage TEXT NOT NULL,
                FOREIGN KEY (submission_uid) REFERENCES submissions (uid)
            )
        """)

        # Create indexer_state table
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS indexer_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                last_block INTEGER NOT NULL,
                last_attestation_uid TEXT NOT NULL,
                processed_count INTEGER NOT NULL,
                error_count INTEGER NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

    def generate_fake_ip(self) -> str:
        """Generate a realistic IP address"""
        # Mix of private and public IPs for realism
        if random.random() < 0.3:  # 30% private IPs
            private_ranges = [
                "192.168.1.0/24",
                "10.0.0.0/16",
                "172.16.0.0/12"
            ]
            network = ipaddress.ip_network(random.choice(private_ranges))
            return str(network[random.randint(1, min(254, network.num_addresses - 1))])
        else:
            # Generate realistic public IPs
            return fake.ipv4()

    def generate_fake_submission(self) -> Dict[str, Any]:
        """Generate a fake submission"""
        now = int(datetime.now().timestamp())
        started_at = now - random.randint(3600, 86400 * 7)  # 1 hour to 7 days ago
        duration = random.randint(300, 3600)  # 5 minutes to 1 hour
        finished_at = started_at + duration

        # Generate status with realistic distribution
        status_weights = [('completed', 0.7), ('processing', 0.15), ('pending', 0.1), ('failed', 0.05)]
        status = random.choices([s for s, _ in status_weights], [w for _, w in status_weights])[0]

        tool, version = random.choice(TOOLS)

        return {
            'uid': str(uuid.uuid4()),
            'submitter': f"0x{random.randint(10**39, 10**40-1):x}",
            'job_id': f"job_{random.randint(1000, 9999)}",
            'namespace': 'default',
            'dataset_type': random.choice(DATASET_TYPES),
            'cid': f"bafy{random.randint(1000000000000000000, 9999999999999999999)}",
            'merkle_root': hashlib.sha256(fake.binary(length=32)).hexdigest(),
            'target_spec_cid': f"bafy{random.randint(1000000000000000000, 9999999999999999999)}",
            'started_at': started_at,
            'finished_at': finished_at,
            'tool': tool,
            'version': version,
            'vantage': fake.country_code(),
            'manifest_sha256': hashlib.sha256(fake.text().encode()).hexdigest(),
            'extra': fake.binary(length=64),
            'timestamp': started_at,
            'processed_at': datetime.now().isoformat() if status == 'completed' else None,
            'status': status,
            'error_message': fake.sentence() if status == 'failed' else None,
            'created_at': datetime.fromtimestamp(started_at).isoformat()
        }

    def generate_fake_record(self, submission_uid: str, tool: str, tool_version: str) -> Dict[str, Any]:
        """Generate a fake record"""
        ip = self.generate_fake_ip()
        port = random.choice(list(COMMON_SERVICES.keys()) + [random.randint(1, 65535)])
        service = COMMON_SERVICES.get(port, None)

        # Generate realistic state
        states = ['open', 'closed', 'filtered']
        state_weights = [('open', 0.6), ('closed', 0.3), ('filtered', 0.1)]
        state = random.choices([s for s, _ in state_weights], [w for _, w in state_weights])[0]

        record = {
            'submission_uid': submission_uid,
            'timestamp': int(datetime.now().timestamp()),
            'ip': ip,
            'port': port,
            'protocol': random.choice(['tcp', 'udp']),
            'state': state,
            'service': service,
            'product': fake.company() if service and random.random() < 0.7 else None,
            'version': f"{random.randint(1, 10)}.{random.randint(0, 9)}.{random.randint(0, 9)}" if service and random.random() < 0.5 else None,
            'banner_sha256': hashlib.sha256(fake.text().encode()).hexdigest() if random.random() < 0.3 else None,
            'cert_fpr': hashlib.sha256(fake.binary(length=32)).hexdigest() if port in [443, 8443] and random.random() < 0.5 else None,
            'tls_ja3': hashlib.sha256(fake.binary(length=32)).hexdigest() if port in [443, 8443] and random.random() < 0.4 else None,
            'latency_ms': random.randint(10, 1000) if state == 'open' else None,
            'tool': tool,
            'tool_version': tool_version,
            'options': json.dumps({
                'timeout': random.randint(1000, 5000),
                'retries': random.randint(1, 3),
                'max_rtt_timeout': random.randint(100, 1000)
            }),
            'vantage': fake.country_code()
        }

        return record

    async def insert_submission(self, submission: Dict[str, Any]):
        """Insert a submission into the database"""
        await self.db.execute("""
            INSERT INTO submissions (
                uid, submitter, job_id, namespace, dataset_type, cid, merkle_root,
                target_spec_cid, started_at, finished_at, tool, version, vantage,
                manifest_sha256, extra, timestamp, processed_at, status,
                error_message, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            submission['uid'], submission['submitter'], submission['job_id'],
            submission['namespace'], submission['dataset_type'], submission['cid'],
            submission['merkle_root'], submission['target_spec_cid'],
            submission['started_at'], submission['finished_at'], submission['tool'],
            submission['version'], submission['vantage'], submission['manifest_sha256'],
            submission['extra'], submission['timestamp'], submission['processed_at'],
            submission['status'], submission['error_message'], submission['created_at']
        ])
        await self.db.commit()

    async def insert_record(self, record: Dict[str, Any]):
        """Insert a record into the database"""
        await self.db.execute("""
            INSERT INTO records (
                submission_uid, timestamp, ip, port, protocol, state, service,
                product, version, banner_sha256, cert_fpr, tls_ja3, latency_ms,
                tool, tool_version, options, vantage
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            record['submission_uid'], record['timestamp'], record['ip'],
            record['port'], record['protocol'], record['state'], record['service'],
            record['product'], record['version'], record['banner_sha256'],
            record['cert_fpr'], record['tls_ja3'], record['latency_ms'],
            record['tool'], record['tool_version'], record['options'],
            record['vantage']
        ])
        await self.db.commit()

    async def insert_indexer_state(self):
        """Insert indexer state"""
        await self.db.execute("""
            INSERT OR REPLACE INTO indexer_state (
                id, last_block, last_attestation_uid, processed_count,
                error_count, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, [
            1,
            random.randint(18000000, 19000000),  # Recent Base block
            str(uuid.uuid4()),
            random.randint(100, 1000),
            random.randint(0, 10),
            datetime.now().isoformat()
        ])
        await self.db.commit()

    async def generate_fake_data(self, num_submissions: int = 10, records_per_submission: int = 50):
        """Generate and insert fake data"""
        print(f"🎭 Generating fake data: {num_submissions} submissions, ~{num_submissions * records_per_submission} records")

        # Generate submissions
        submissions = []
        for i in range(num_submissions):
            submission = self.generate_fake_submission()
            submissions.append(submission)
            await self.insert_submission(submission)

            if (i + 1) % 5 == 0:
                print(f"📝 Created {i + 1}/{num_submissions} submissions")

        # Generate records for each submission
        total_records = 0
        for submission in submissions:
            # Vary the number of records per submission
            num_records = random.randint(max(10, records_per_submission // 2), records_per_submission * 2)

            for _ in range(num_records):
                record = self.generate_fake_record(
                    submission['uid'],
                    submission['tool'],
                    submission['version']
                )
                await self.insert_record(record)
                total_records += 1

            if (submissions.index(submission) + 1) % 5 == 0:
                print(f"📊 Created records for {submissions.index(submission) + 1}/{num_submissions} submissions")

        # Insert indexer state
        await self.insert_indexer_state()

        print(f"✅ Generated {len(submissions)} submissions and {total_records} records")
        return len(submissions), total_records

    async def get_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        async with self.db.execute("SELECT COUNT(*) as count FROM submissions") as cursor:
            submission_count = await cursor.fetchone()

        async with self.db.execute("SELECT COUNT(*) as count FROM records") as cursor:
            record_count = await cursor.fetchone()

        async with self.db.execute("SELECT COUNT(DISTINCT ip) as count FROM records") as cursor:
            unique_ips = await cursor.fetchone()

        async with self.db.execute("SELECT COUNT(DISTINCT service) as count FROM records WHERE service IS NOT NULL") as cursor:
            unique_services = await cursor.fetchone()

        return {
            'submissions': submission_count[0],
            'records': record_count[0],
            'unique_ips': unique_ips[0],
            'unique_services': unique_services[0]
        }

async def main():
    """Main function"""
    print("🚀 nweb Fake Data Generator")
    print("=" * 50)

    if not SQLITE_AVAILABLE:
        print("❌ SQLite is not available. Install with: pip install aiosqlite")
        return

    # Initialize generator
    generator = FakeDataGenerator()

    try:
        await generator.init_db()
        print("✅ Database initialized")

        # Generate fake data
        submissions, records = await generator.generate_fake_data(
            num_submissions=20,
            records_per_submission=100
        )

        # Get and display stats
        stats = await generator.get_stats()
        print("\n📊 Database Statistics:")
        print(f"   Submissions: {stats['submissions']}")
        print(f"   Records: {stats['records']}")
        print(f"   Unique IPs: {stats['unique_ips']}")
        print(f"   Unique Services: {stats['unique_services']}")

        print("\n✅ Fake data generation completed successfully!")
        print(f"📁 Database file: {generator.db_path}")

    except Exception as e:
        print(f"❌ Error: {e}")
        raise
    finally:
        if generator.db:
            await generator.db.close()

if __name__ == "__main__":
    asyncio.run(main())
