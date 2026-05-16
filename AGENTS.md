# nweb — AGENTS

This file is the canonical instruction notebook for coding agents and human operators working in this repository. Update it when you learn something durable about the codebase, workflow, or collaborator preferences.

## Coding Agent Operating Loop

- Start every task by checking `git status -sb`, reading the local instructions, and identifying the current branch.
- Keep work in focused steps. Avoid unrelated refactors and never revert changes you did not make unless explicitly asked.
- Prefer inspectable CLI workflows: `rg`, `git`, `npm`, `uv`, `forge`, `curl`, and small scripts that can be repeated.
- Before making claims, verify with the narrowest useful command. Record commands that worked here when they are likely to help future agents.
- When you learn a project convention, pitfall, or collaborator preference, update this file in the same task.
- End each completed task by committing and pushing. If the worktree includes unrelated changes, stage only the files in scope. If push fails, explain the blocker and leave the commit local.
- `AGENTS.md` is canonical. If another harness needs `CLAUDE.md`, `GEMINI.md`, or similar, make it a symlink to this file rather than maintaining duplicate instructions.

### Recursive Self-Improvement

Treat improvements to the agent workflow as part of the project. Useful updates include:

- Verified build, test, run, scan, and deploy commands.
- Project structure and ownership boundaries.
- Known failures, confusing errors, and their fixes.
- Local service ports, data files, and generated artifacts to avoid committing.
- User preferences, especially around commit/push cadence, UI expectations, and fake data.
- Suggestions for future agents that reduce repeated investigation.

Do not hoard vague notes. Keep this file concise, concrete, and pruned when older guidance becomes wrong.

## Repository Shape

- `collector/`: Python scanner and bundle builder. Runs `nmap`, writes scan bundles, can post directly to Analyst in local development, and can publish/submit through IPFS/Base paths.
- `dispatcher/`: TypeScript HTTP service on `127.0.0.1:7778` by default. Serves `/getwork`, random public IPv4 work, and Analyst-submitted priority domains through `/targets`.
- `analyst/`: Next.js app on `127.0.0.1:3000` by default. Uses SQLite locally when `POSTGRES_URL` is unset and exposes local APIs for dashboard stats, submissions, host views, target queue proxying, and local scan indexing.
- `indexer/`: Python indexer that watches chain submissions, fetches bundles from IPFS, validates/parses them, and writes database rows.
- `contracts/`: Foundry contracts for attestation, staking, submission routing, slashing, and deployment scripts.
- `testing/`: Local pipeline tests. Fake/demo data generators were removed; do not reintroduce fake Analyst data.

## Verified Commands

Run the smallest relevant subset for the task.

```bash
# Dispatcher
cd dispatcher && npm test && npm run type-check && npm run build

# Analyst
cd analyst && npm run type-check && npm run build

# Indexer
cd indexer && uv run --extra dev python -m pytest tests/test_indexer.py

# Collector
cd collector && UV_CACHE_DIR=/tmp/nweb-uv-cache-collector-editable uv run --with-editable . --with pytest pytest

# Local pipeline tests
UV_CACHE_DIR=/tmp/nweb-uv-cache-local-pipeline uv run --with pytest pytest testing/test_local_pipeline.py

# Contracts
cd contracts && forge build && forge test
```

Local services:

```bash
./run-dispatcher.sh
ENABLE_PUBLIC_SUBMIT=true ./run-analyst.sh
./run-collector.sh --help
./run-collector.sh --ip 8.8.8.8
./run-collector.sh --continuous --interval 30
```

Known local URLs:

- Analyst UI: http://127.0.0.1:3000
- Analyst submissions: http://127.0.0.1:3000/submissions
- Analyst target queue UI: http://127.0.0.1:3000/targets
- Dispatcher health: http://127.0.0.1:7778/health
- Dispatcher work: http://127.0.0.1:7778/getwork

## Pitfalls And Local Rules

- No fake dashboard or demo data. The Analyst should show only real indexed rows.
- `analyst/nweb-analyst.db`, `collector/runs/`, `.next/`, `node_modules/`, build outputs, venvs, caches, and `analyst/tsconfig.tsbuildinfo` are generated/local and should not be committed.
- Do not run `next build` while `next dev` is using the same `.next` directory. Stop the dev server first, or remove `.next` before rebuilding.
- If port `3000` is occupied, inspect and stop stale Analyst processes before starting another one. Avoid leaving duplicate dev servers on `3001`.
- The Analyst does not pull directly from IPFS. It reads the indexed database. The indexer owns IPFS fetching and parsing in the network path.
- Indexer and Analyst Postgres URLs intentionally differ: indexer uses SQLAlchemy asyncpg, e.g. `postgresql+asyncpg://nweb:<password>@127.0.0.1:5432/nweb`; Analyst/Vercel uses node-postgres/Kysely with a read-only role, e.g. `postgresql://nweb_analyst_ro:<password>@50.126.86.253:5432/nweb?sslmode=require`.
- Public Analyst `/api/submit` is disabled unless `ENABLE_PUBLIC_SUBMIT=true` is set server-side. Keep Vercel on read-only DB credentials.
- For the local Dispatcher -> Collector -> Analyst path, start Analyst with `ENABLE_PUBLIC_SUBMIT=true ./run-analyst.sh`; otherwise collector indexing to `/api/submit` returns 403.
- Analyst API routes should classify database connection failures through `logAPIError`/`toAPIError` and return `503 DATABASE_UNAVAILABLE` instead of logging raw pg stack traces.
- For local development, `run-collector.sh` can post directly to `http://127.0.0.1:3000/api/submit`.
- The indexer package console script currently imports a missing `main` from `indexer.cli`; use `cd indexer && uv run python -m indexer.cli stats` or `... run` until the entrypoint is fixed.
- Dispatcher priority domains come from Analyst `/targets` and are returned before random IPv4/static work.
- Random IPv4 work excludes private, loopback, link-local, multicast, documentation, benchmarking, and reserved ranges, but operators remain responsible for lawful scanning.
- Use `-Pn` for local collector scans when host discovery blocks useful results. `run-collector.sh` defaults to no ping.
- Commit and push after every completed task. Use a branch when working from `main`.

## Collaboration Preferences

- Be direct and concrete. Prefer verified facts over speculative explanations.
- Keep frontend UI operational and data-dense; avoid fake placeholders and marketing-style pages.
- When a user reports “it’s not showing up,” trace the exact UID/IP through DB, API, and UI before changing behavior.
- If a task uses a web source such as https://recurse.bot, adapt the guidance to this repository rather than copying it wholesale.

---

# How You Can Participate

Welcome! Pick your path: **run nodes**, **analyze data**, or **build code**. Everything is local-first and composable.

---

## TL;DR — Choose Your Role

### 1) Run a **Collector** (earn reputation; publish data)
- Best if you have **bandwidth + compute** to scan.
- You’ll run `nmap`, capture optional assets (HTTP/RDP/VNC), build a bundle, add to IPFS, and publish a **ScanSubmission** attestation on Base.
- **One-liner (Docker):**
  ```bash
  docker run --rm -it     -e RPC_URL=$RPC_URL     -e ATTESTOR_ADDRESS=$ATTESTOR_ADDRESS     -e SUBMISSION_ROUTER_ADDRESS=$SUBMISSION_ROUTER_ADDRESS     -e STAKE_REGISTRY_ADDRESS=$STAKE_REGISTRY_ADDRESS     -e WALLET_KEYSTORE=/keys/keystore.json     -e KEYSTORE_PASSWORD='prompt'     -e IPFS_API=http://host.docker.internal:5001     -v $HOME/.nweb/keys:/keys     ghcr.io/pierce403/nweb-collector:latest     --targets asn:AS13335 --profile top-1000 --with-assets
  ```
- **You are responsible** for lawful scanning and storage. See “Ethics & Safety” below.

### 2) Run a **Hoarder** (keep your data alive)
- Ideal if you operate **many collectors** but a few **storage nodes**.
- Pins **your** CIDs, renews deals (optional), exposes a health endpoint.
- Start:
  ```bash
  cd hoarder
  uv venv && source .venv/bin/activate
  uv pip install -r requirements.txt
  uv run python -m hoarder --watch-wallet 0xYourAddr
  ```

### 3) Run an **Indexer** + **Analyst**
- For researchers and defenders: mirror the network and explore locally.
- Start indexer:
  ```bash
  cd indexer
  uv venv && source .venv/bin/activate
  uv pip install -r requirements.txt
  uv run python -m indexer
  ```
- Start Analyst UI:
  ```bash
  cd analyst
  pnpm install
  pnpm dev
  ```
- Browse http://localhost:3000 to search IPs, ASNs, diffs, and view submissions.

### 4) Run a **Slasher** (earn bounties by keeping the network honest)
- Periodically checks if CIDs are **available** and **valid**.
- Files **Challenge** attestations if bundles fail checks; after **72h**, calls `processTimeout` to **slash** (10%) and claim bounty (50% of slashed).
  ```bash
  cd slasher
  uv venv && source .venv/bin/activate
  uv pip install -r requirements.txt
  uv run python -m slasher --follow --attempts 5
  ```

### 5) Operate a **Dispatcher** (publish signals)
- Share target specs for collectors via **open** `/getwork`.
  ```bash
  cd dispatcher
  npm install
  npm run dev
  ```

### 6) Write **Smart Contracts** / Protocol Code
- Foundry contracts for stake/attest/challenge flows.
  ```bash
  cd contracts
  forge build && forge test
  ```

---

## What Do I Need?

**Minimum setup**
- Base mainnet RPC
- IPFS (Kubo)
- Postgres 16 (for indexer/analyst)
- Wallet + a bit of ETH on Base for gas
- GST stake (min **100 GST**) to submit complex claims (quota-gated)

**Hardware hints**
- Collector: modern 4+ cores, 16GB RAM recommended (spikes during parses and screenshots)
- Hoarder: storage heavy (NVMe), stable bandwidth
- Indexer: CPU + disk IO, Postgres tuned (work_mem, effective_cache_size)
- Analyst: any dev machine (Next.js + local API)

---

## Rewards & Reputation (high level)
- Submissions that survive the **72h grace** without a successful challenge **increase reputation**.
- Reputation + stake → **quota** for complex datasets (e.g., `nmap-full`).
- Slasher earns **50%** of slashed amount when challenges time out.

---

## Ethics & Safety
- **You** are responsible for complying with laws and policies where you scan.
- Default screenshot capture is **ON** and **unredacted**. Consider your jurisdiction before enabling.
- Use polite scan rates and respect opt-out lists.
- Keep keys secure (hardware wallet / encrypted keystore).

---

## Developer Paths

### Improve the Collector
- Faster bundle builds, optional redaction pipeline, better screenshotting.
- Add new dataset types (e.g., TLS transcript summaries).

### Extend the Analyst
- Diff tools, ASN heatmaps, novelty scoring, export CSVs.

### Harden the Indexer
- Streaming parsers, large-file resilience, Merkle proof surfacing.

### Contracts & Governance
- Gradual path to on-chain payouts; later Safe governance; ZK/TEE proofs as optional modules.

---

## Stuck? Common Questions

**Q: I don’t see any submissions.**  
A: Check `.env` addresses, Base RPC connectivity, and IPFS gateway reachability.

**Q: My CID pins locally but gateways fail.**  
A: Ensure your node is public-reachable (swarm), consider a pinning backup, or publish a CAR mirror.

**Q: I submitted the wrong CID.**  
A: Publish a `Resolution` attestation with `newCid` before 72h expires.

**Q: Do I get paid automatically?**  
A: MVP focuses on **reputation + slashing economics**. Direct GST reward pools are future work.

---

Happy hacking! Pick a role, run a node, or ship code. 🚀
