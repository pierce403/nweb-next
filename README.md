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

## How The Network Fits Together

nweb splits the work into small roles that can be run independently. The normal data path is:

```
dispatcher -> collector -> IPFS + Base attestation -> indexer -> database -> analyst
                                      ^
                                      |
                                  slasher / hoarder
```

- **Dispatcher** publishes target suggestions. It does not scan or attest data.
- **Collector** performs scans, writes a portable bundle, stores it on IPFS, and attests the bundle CID on Base.
- **Hoarder** keeps submitted CIDs pinned and reachable.
- **Indexer** watches attestations, pulls bundles from IPFS, parses them, and writes queryable rows.
- **Analyst** reads the indexed database and provides the search/UI layer.
- **Slasher** checks whether submitted bundles remain available and valid, then challenges bad submissions.
- **Contracts** define staking, submission routing, challenge routing, and attestation events.

### Collector

Collectors are the data producers. A collector expands target specs such as `ip:`, `host:`, or `cidr:`, runs `nmap`, normalizes results into `scanprint.v0.jsonl`, includes raw artifacts such as `raw/nmap.xml`, and writes a `manifest.json`.

With `--ipfs-add`, the collector adds the bundle directory to Kubo using canonical UnixFS settings and receives a root CID. With `--submit`, it sends that CID plus scan metadata through `SubmissionRouter` as a `ScanSubmission` attestation.

Collectors need:
- `nmap`
- IPFS API access when publishing bundles
- Base RPC, a funded wallet, and deployed contract addresses when submitting on-chain
- Enough local compute and bandwidth for the scan profile

Collectors are responsible for lawful scanning, polite rates, storage decisions, and key safety.

### Hoarder

Hoarders are storage keepers. They watch a wallet or submission stream, pin relevant bundle CIDs, and keep those CIDs retrievable after the original collector goes offline.

The role is useful when many short-lived collectors publish data but only a few stable machines should carry long-term storage. Future hoarder work includes CAR export, deal renewal, and Prometheus-style health reporting.

### Indexer

Indexers turn public submissions into a local query mirror. The indexer watches Base for `ScanSubmission` attestations, filters by schema UID, extracts bundle CIDs, fetches those bundles from IPFS, verifies/parses the manifest and scanprint data, and writes normalized rows into Postgres.

The Analyst does not currently pull directly from IPFS. It depends on the indexer-populated database. This keeps UI queries fast and keeps IPFS fetching, verification, and retry logic out of the web app.

Indexers need:
- Base RPC
- Attestor and schema configuration
- IPFS API/gateway access
- Postgres

### Analyst

Analyst is the local browser for indexed data. It is a Next.js app with API routes that query `submissions`, `records`, and `indexer_state`.

Use it to:
- Search submissions, IPs, services, products, and records
- Inspect an IP/host view
- Check local status and database connectivity
- Build future workflows such as diffs, ASN views, exports, and reputation dashboards

For development, the Analyst can fall back to a local SQLite file when `POSTGRES_URL` is not set. In a full mirror, point it at the same Postgres database the indexer writes to.

### Slasher

Slashers keep the network honest. A slasher periodically probes submitted CIDs through native IPFS and/or gateways, validates bundle shape, and files challenge attestations when data is unavailable or invalid.

Protocol parameters currently target a 72 hour challenge window, a 10% slash, and a 50% bounty to the successful slasher. The slasher role needs strong retry behavior so transient IPFS or gateway failures do not become false challenges.

### Dispatcher

Dispatchers publish scan work. In v1 this is intentionally simple: open `/getwork` target specs for collectors plus a local priority queue that the Analyst can write to. It is off-chain signal, not an authority.

Future dispatcher work includes file/CID-backed work queues, opt-out handling, and policy-aware scan profiles.

### Contracts

The contracts provide the shared protocol surface:

- **Attestor** emits EAS-compatible attestation events and manages schema registration.
- **StakeRegistry** tracks stake and exposes quota-related state.
- **SubmissionRouter** records accepted submission attestation UIDs.
- **SlashRouter** handles challenge timeout/slashing parameters.

The current contracts are Foundry-based and designed so off-chain components can remain simple: collectors submit attestations, indexers watch events, and slashers file challenges.

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

## Local Dispatcher -> Collector -> Analyst Flow

For local development, you can skip Base/IPFS and index a collector run directly into the Analyst database through `/api/submit`.

Start the Analyst:

```bash
./run-analyst.sh
```

Start the Dispatcher in another shell:

```bash
./run-dispatcher.sh
```

Run one collector job from dispatcher work and index it into Analyst:

```bash
./run-collector.sh
```

Analyst operators can add prioritized domains at http://localhost:3000/targets. Those domains are posted to the Dispatcher and returned before random IPv4 or static work.

Defaults:

- Dispatcher: `http://127.0.0.1:7778`
- Analyst index endpoint: `http://127.0.0.1:3000/api/submit`
- Work mode: random globally routable IPv4
- Nmap host discovery: disabled with `-Pn`, so scans still run when ping is blocked
- Vantage: `local/run-collector`

After it finishes, open http://localhost:3000 and search for the scanned IP. If the random host had no open ports, the submission still exists but the records count will be `0`.

Useful modes:

```bash
./run-collector.sh --ip 8.8.8.8
./run-collector.sh --target host:example.com --ping
./run-collector.sh --continuous --interval 30
./run-collector.sh --local
./run-collector.sh --dry-run --ip 1.1.1.1
```

Run `./run-collector.sh --help` for all flags.

This local path is meant for development and demos. The network path remains: collector adds bundles to IPFS, submits a Base attestation, indexer fetches/parses the CID, and Analyst reads the indexed database.

---

## Running a Collector
The collector scans targets, builds the UnixFS bundle, adds to IPFS, and submits a `ScanSubmission` attestation.

```bash
cd collector
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
uv run nweb-collector \
  --targets ip:127.0.0.1 \
  --profile quick \
  --vantage local/dev \
  --work-dir ./runs/local \
  --dry-run
```

To submit, set `RPC_URL`, `PRIVATE_KEY`, `ATTESTOR_ADDRESS`, `SUBMISSION_ROUTER_ADDRESS`, and `SCHEMA_UID_SCAN_SUBMISSION`, then pass `--ipfs-add --submit`. See `collector/README.md`.

---

## Dispatcher (signals only)
Open/public **`/getwork`** endpoint serving target specs (off-chain). Analyst can also POST domains into the dispatcher's priority queue through its `/targets` page.
```bash
./run-dispatcher.sh
```
Collectors can fetch specs (no signature required in v1).

Default URL: http://127.0.0.1:7778/getwork

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

Deploy:
```bash
forge script script/DeployNweb.s.sol:DeployNweb \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

---

## Contributing
See **AGENTS.md** to choose your path (run nodes vs. build code).  
We’ll add **CONTRIBUTING.md** and **CODE_OF_CONDUCT.md** stubs soon.

---

## License
Apache-2.0 © nweb contributors
