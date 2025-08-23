# nweb — AGENTS (How You Can Participate)

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
  pnpm install
  pnpm dev
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
