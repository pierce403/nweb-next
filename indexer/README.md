# nweb Indexer

The nweb indexer watches the Base blockchain for scan submissions and indexes IPFS bundles into a Postgres database for querying and analysis.

## Features

- **Blockchain Monitoring**: Watches for attestation events on Base mainnet
- **IPFS Bundle Processing**: Fetches and parses scan data bundles from IPFS
- **Database Indexing**: Stores structured scan data in Postgres with optimized queries
- **Data Verification**: Verifies bundle integrity and Merkle roots
- **Async Processing**: High-performance async processing with connection pooling

## Installation

### Prerequisites

- Python 3.11+
- Postgres 16+
- IPFS node (Kubo)
- Base mainnet RPC endpoint

### Setup

1. Create a virtual environment:
```bash
cd /home/pierce/projects/nweb2/indexer
python -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:
```bash
pip install -e .
```

3. Set up environment:
```bash
cp ../.env.example .env
# Edit .env with your configuration
```

4. Initialize database:
```bash
createdb nweb
psql -d nweb -c "create user nweb with password 'nweb'; grant all privileges on database nweb to nweb;"
```

## Usage

### Run the indexer:
```bash
nweb-indexer run
```

### Check statistics:
```bash
nweb-indexer stats
```

### Watch from specific block:
```bash
nweb-indexer watch --from-block 12345678
```

## Configuration

Configuration is handled via environment variables:

- `RPC_URL`: Base mainnet RPC endpoint
- `ATTESTOR_ADDRESS`: Attestor contract address
- `SCHEMA_UID_SCAN_SUBMISSION`: Schema UID for scan submissions
- `POSTGRES_URL`: Postgres connection string
- `IPFS_API`: IPFS API endpoint
- `INDEXER_POLL_INTERVAL`: Block polling interval (seconds)
- `INDEXER_BATCH_SIZE`: Number of blocks to process per batch

## Database Schema

### submissions
- `uid`: Attestation UID (primary key)
- `submitter`: Submitter address
- `cid`: IPFS bundle CID
- `status`: Processing status
- `processed_at`: Processing timestamp
- Various metadata fields

### records
- Individual scan records from nmap output
- IP, port, service, version data
- Linked to submissions table

## Architecture

The indexer consists of several key components:

1. **BlockchainWatcher**: Monitors blockchain for attestation events
2. **IPFSClient**: Fetches and verifies bundles from IPFS
3. **DatabaseManager**: Handles Postgres connections and queries
4. **IndexerService**: Coordinates all components

## Development

### Running tests:
```bash
pytest
```

### Code formatting:
```bash
black indexer/
isort indexer/
```

### Type checking:
```bash
mypy indexer/
```

## Troubleshooting

### Common Issues

1. **Database connection errors**: Check POSTGRES_URL and ensure database exists
2. **IPFS fetch timeouts**: Verify IPFS node is running and accessible
3. **Blockchain connection errors**: Check RPC_URL and network connectivity
4. **Memory issues**: Reduce INDEXER_BATCH_SIZE for limited memory systems

### Logs

The indexer uses structured logging with `structlog`. Logs include:
- Processing status for each submission
- Error details with context
- Performance metrics

## Contributing

1. Follow the existing code style
2. Add tests for new functionality
3. Update documentation as needed
4. Ensure all tests pass before submitting PRs
