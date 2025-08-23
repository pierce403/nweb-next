# nweb — ARCHITECTURE

**Network-first, local-first OSINT for the live internet.**  
nweb coordinates collectors, hoarders, indexers, analysts, and challengers using a simple on-chain attestation + staking layer on **Base mainnet**, while all heavy data lives off-chain as **IPFS UnixFS bundles**.

---

## High-Level Goals
- **Zero central verification:** Truth emerges from public **attestations**, economic **stake**, and **challenges** with time-boxed slashing.
- **Local-first:** Anyone can mirror: run an IPFS node, index locally to Postgres, and browse via the Analyst UI.
- **Composable data:** A standard **bundle manifest** + **scanprint v0** JSONL for both `nmap` (nweb.io) and `masscan` (masspull.org).
- **Simple, immutable rules:** Fixed grace periods, slash %, and bounty splits in the MVP.

---

## Components
- **collector/** (Python CLI)  
  Runs scans, builds an **IPFS UnixFS bundle**, and submits a **ScanSubmission attestation** on-chain.
- **hoarder/** (Python CLI)  
  Keeps *its owner’s* bundles alive (pinning, optional CAR exports); emits local health metrics.
- **indexer/** (Python CLI)  
  Watches the chain, fetches bundles via IPFS, verifies, parses into Postgres for search & analytics.
- **analyst/** (Next.js + local API routes)  
  Web UI talking to the local API → Postgres. No SaaS required.
- **dispatcher/** (Node/TS)  
  Off-chain “signal” server (e.g., `/getwork`) that publishes target specs. **Open/public** in v1.
- **slasher/** (Python CLI)  
  Availability checker + challenger. Files **Challenge** attestations if bundles are missing/invalid.
- **contracts/** (Solidity / Foundry)  
  Minimal, EAS-compatible **Attestor**, **StakeRegistry**, **SlashRouter**, **SubmissionRouter**.

---

## On-Chain vs Off-Chain

### On-Chain (Base mainnet)
- **GST token**: *bridged from L1; placeholder address for now.*
- **StakeRegistry**: stake GST → **quota** & **slashability**.
- **SubmissionRouter**: records EAS-compatible **attestation UIDs**.
- **SlashRouter**: enforces **immutable** slashing rules on challenge timeout.

> **MVP parameters (immutable):**  
> - Grace: **72h**  
> - Slash: **10%** of staked GST (address-level; amount configurable per function call scope)  
> - Bounty split: **50% challenger / 50% burned**  
> - Minimum stake to submit: **100 GST**  
> - Quota: `quotaUnits = floor( sqrt(stake) * (1 + repFactor) )`  
>   - Cost: `masscan-quick=1`, `nmap-top1k=2`, `nmap-full=5`, `diff/enrich=1`

### Off-Chain (peer-run)
- **Bundles**: IPFS **UnixFS directory** with `manifest.json`, `scanprint.v0.jsonl`, raw `nmap.xml`, optional screenshots under `/assets/…`.
- **Availability**: IPFS pinning via hoarders; slasher/others can probe via multiple gateways and native IPFS.
- **Datastore**: Local **Postgres 16** (SQLite supported for tiny nodes, but Postgres is the default).

---

## Data Model

### Bundle Layout (UnixFS directory)
```
/manifest.json                     # required
/scanprint/scanprint.v0.jsonl      # required
/raw/nmap.xml                      # required for nmap-based submissions
/assets/screenshots/{ip}/{ts}/...  # optional: RDP/VNC/HTTP captures (ON by default, no redaction in v1)
```

### `manifest.json` (v1)
```json
{
  "schema": "nweb.bundle.v1",
  "namespace": "nweb.io",
  "datasetType": "nmap",
  "scanprint": {
    "path": "scanprint/scanprint.v0.jsonl",
    "merkleRoot": "0x..."
  },
  "artifacts": [
    { "path": "raw/nmap.xml", "sha256": "..." },
    { "path": "assets/screenshots/203.0.113.42/1693526400/rdp.png", "sha256": "..." }
  ],
  "targetSpecCid": "bafy...",
  "tool": "nmap",
  "toolVersion": "7.95",
  "vantage": "AS1234/us-west-2",
  "startedAt": 1693526400,
  "finishedAt": 1693529999,
  "notes": "optional free-form"
}
```

### `scanprint v0` (JSONL; Merkle root computed over canonicalized lines)
```json
{"ts":1693526400,"ip":"203.0.113.42","port":443,"proto":"tcp","state":"open","service":"https","product":"nginx","version":"1.24.0","banner_sha256":"...","cert_fpr":"sha256:...","tls_ja3":"...","latency_ms":21,"tool":"nmap","tool_version":"7.95","options":"top-1000,T3","vantage":"AS1234/us-west-2"}
```
- Privacy-first defaults (hashes/fingerprints), while the raw `nmap.xml` remains in the bundle.

---

## Attestation Schemas (EAS-compatible)

> We use a **lightweight Attestor** contract that emits EAS-compatible events and exposes `schemaUID` namespaces, without relying on the main EAS Hub.

**A. `ScanSubmission`**
```
(address subject, bytes32 jobId, string namespace,
 string datasetType, string cid, bytes32 merkleRoot,
 string targetSpecCid, uint64 startedAt, uint64 finishedAt,
 string tool, string version, string vantage, string manifestSha256, bytes extra)
```

**B. `AvailabilityCheck`**
```
(string cid, bool available, uint8 attempts, uint8 gatewaysOk,
 bytes32 fetchDigest, uint64 checkedAt)
```

**C. `Challenge`**
```
(bytes32 jobId, string cid, bytes32 reasonCode, string evidenceCid, uint64 graceEndsAt)
```

**D. `Resolution`**
```
(bytes32 challengeId, bool slash, uint256 slashAmount, string notes, string newCid)
```

> **Reason codes:** `CID_UNAVAILABLE`, `CID_HASH_MISMATCH`, `FORMAT_INVALID`.

---

## Flows

### 1) Submit (Collector → Chain)
```
Collector
  ├─ run scan (nmap)
  ├─ build bundle (UnixFS dir + manifest.json)
  ├─ compute MerkleRoot over scanprint.v0.jsonl
  ├─ ipfs add --cid-version=1 --raw-leaves --wrap-with-directory
  └─ attest ScanSubmission (cid, merkleRoot, manifestSha256, ...)

Indexer
  ├─ watch Attestor events
  ├─ ipfs pin <cid>
  ├─ verify manifest / merkleRoot
  └─ parse → Postgres
```

### 2) Challenge (Slasher/Watcher)
```
Watcher
  ├─ probe cid across gateways/native
  ├─ if unavailable: attest AvailabilityCheck(available=false)
  └─ file Challenge(cid, reasonCode, graceEndsAt=now+72h)

SlashRouter
  └─ after grace, if no valid Resolution, SLASH 10%
       → 50% bounty to challenger, 50% burned
```

### 3) Resolve Fix (Submitter)
```
Collector/Hoarder
  ├─ repin or publish newCid for same bundle
  └─ attest Resolution(challengeId, slash=false, newCid)
```

---

## Reputation & Quota
- **Reputation accrues** for submissions that survive grace without successful challenges, weighted by dataset complexity & vantage rarity.
- **Decay** over time to prefer recent quality work.
- **Quota gating** uses stake + rep to limit high-complexity submissions.

---

## Ports & Defaults
- Analyst UI: **3000**
- Local API: **7777**
- Postgres: **5432**
- IPFS (Kubo): **5001** (API), **8080** (gateway), **4001** (swarm)

---

## Security & Ethics
- **Legal:** You’re responsible for complying with scanning laws and etiquette in your jurisdiction.
- **Default assets capture:** **ON** (no redaction). Disable via collector flags if needed.
- Maintain **opt-out/deny lists**; publish an allow/deny CID; encourage polite rate limits.
- Keep **keys** in encrypted keystores; never commit secrets.

---

## Placeholder Addresses (Base mainnet)
- `GST_TOKEN_ADDRESS`: `0xGST_PLACEHOLDER`
- `STAKE_REGISTRY_ADDRESS`: `0xSR_PLACEHOLDER`
- `SUBMISSION_ROUTER_ADDRESS`: `0xSUB_PLACEHOLDER`
- `SLASH_ROUTER_ADDRESS`: `0xSLASH_PLACEHOLDER`
- `ATTESTOR_ADDRESS`: `0xATT_PLACEHOLDER`
- `SCHEMA_UID_SCAN_SUBMISSION`: `0xSCHEMA_SUB_PLACEHOLDER`

(Replace via `.env` when deployed.)
