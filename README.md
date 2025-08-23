# nweb-next

**Explore the internet like a dataset.**  
Run scans, publish attestations to Base mainnet, store data on IPFS, and browse everything locally.

- **Network:** Base mainnet
- **Docs:** ARCHITECTURE.md, AGENTS.md, TODO.md
- **License:** Apache-2.0

---

## Repo Layout (flat)
```
/ARCHITECTURE.md  /AGENTS.md  /README.md  /TODO.md  /ENVIRONMENT.md
/collector/  /hoarder/  /indexer/  /analyst/  /dispatcher/  /slasher/  /contracts/
/shared/  /scripts/  run-analyst.sh  vercel.json
```

---

## Quick Start (Local Mirror)

### Prereqs
- **Python 3.11+** and **uv** (https://docs.astral.sh/uv/)
- **Node 20+** and **pnpm**
- **Postgres 16**
- **IPFS Kubo** (or run via Docker)
- A **Base mainnet RPC** endpoint

### 0) Configure `.env`
Copy `.env.example` → `.env` and set:
```
RPC_URL=<your Base mainnet RPC>
GST_TOKEN_ADDRESS=0xGST_PLACEHOLDER
STAKE_REGISTRY_ADDRESS=0xSR_PLACEHOLDER
SUBMISSION_ROUTER_ADDRESS=0xSUB_PLACEHOLDER
SLASH_ROUTER_ADDRESS=0xSLASH_PLACEHOLDER
ATTESTOR_ADDRESS=0xATT_PLACEHOLDER
SCHEMA_UID_SCAN_SUBMISSION=0xSCHEMA_SUB_PLACEHOLDER

POSTGRES_URL=postgresql://nweb:nweb@localhost:5432/nweb
IPFS_API=http://127.0.0.1:5001
IPFS_GATEWAY=http://127.0.0.1:8080
```

### 1) Start IPFS & Postgres
- IPFS: `ipfs daemon` (or run Kubo via Docker)
- Postgres: create DB/user:
  ```bash
  createdb nweb
  psql -d nweb -c "create user nweb with password 'nweb'; grant all privileges on database nweb to nweb;"
  ```

### 2) Run the **indexer/**
```bash
cd indexer
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
uv run python -m indexer
```
It will:
- Watch the **Attestor** for `ScanSubmission` UIDs
- Pin bundle CIDs via IPFS
- Verify & parse into **Postgres**

### 3) Run the **analyst/** app (local API + UI)

#### Option A: Using the convenience script
```bash
./run-analyst.sh
```

#### Option B: Manual setup
```bash
cd analyst
pnpm install
pnpm dev
```

Open http://localhost:3000 — it talks to the local API (port **7777**) bundled with the app.

#### Database Configuration
The analyst app supports both PostgreSQL and PGLite (SQLite-compatible fallback):
- **PostgreSQL**: Set `POSTGRES_URL` environment variable
- **PGLite**: Automatic fallback if no `POSTGRES_URL` is provided
- See `ENVIRONMENT.md` for configuration details

#### Vercel Deployment
The analyst app is configured for Vercel deployment with automatic database fallback:
```bash
# Deploy to Vercel
vercel --prod

# Or link and deploy
vercel link
vercel --prod
```

#### Testing with Fake Data
To populate the analyst with realistic test data:
```bash
cd testing && ./setup_test_data.sh
```
This creates fake submissions, records, and indexer state for testing the analyst interface.

---

## Running a Collector (Docker one-liner)
The collector scans targets, builds the UnixFS bundle, adds to IPFS, and submits a ScanSubmission attestation.

> Image path (GHCR): **`ghcr.io/pierce403/nweb-collector:latest`**

```bash
docker run --rm -it   -e RPC_URL=$RPC_URL   -e ATTESTOR_ADDRESS=$ATTESTOR_ADDRESS   -e SUBMISSION_ROUTER_ADDRESS=$SUBMISSION_ROUTER_ADDRESS   -e STAKE_REGISTRY_ADDRESS=$STAKE_REGISTRY_ADDRESS   -e WALLET_KEYSTORE=/keys/keystore.json   -e KEYSTORE_PASSWORD='prompt'   -e IPFS_API=http://host.docker.internal:5001   -v $HOME/.nweb/keys:/keys   ghcr.io/pierce403/nweb-collector:latest   --targets asn:AS13335 --profile top-1000 --with-assets
```

**Notes**
- Default **assets capture = ON** (no redaction). Use `--no-assets` to disable.
- Use a hardware wallet or encrypted keystore. Never bake private keys into images.

---

## Dispatcher (signals only)
Open/public **`/getwork`** endpoint serving target specs (off-chain).
```bash
cd dispatcher
pnpm install
pnpm dev
```
Collectors can fetch specs (no signature required in v1).

---

## Slasher (challenge agent)
Checks availability via multiple gateways/native IPFS; files **Challenge** attestations when bundles are unfetchable or invalid.
```bash
cd slasher
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
uv run python -m slasher --follow --attempts 5
```

---

## Contracts
Solidity / Foundry projects for:
- **StakeRegistry** (stake → quota)
- **SubmissionRouter** (record attestation UIDs)
- **SlashRouter** (immutable parameters)
- **Attestor** (EAS-compatible, lightweight)

Build & test:
```bash
cd contracts
forge install
forge build
forge test
```

---

## Contributing
See **AGENTS.md** to choose your path (run nodes vs. build code).  
We’ll add **CONTRIBUTING.md** and **CODE_OF_CONDUCT.md** stubs soon.

---

## License
Apache-2.0 © nweb contributors
