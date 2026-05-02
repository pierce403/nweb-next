# nweb — TODO

## 💥 v0 Milestone (MVP Network)
- [x] **Contracts** (Foundry)
  - [x] Attestor (EAS-compatible events; schema registry)
  - [x] StakeRegistry (stake, withdraw, quota view)
  - [x] SubmissionRouter (record attestation UID, emit events)
  - [x] SlashRouter (immutable params: 72h, 10% slash, 50/50 bounty)
  - [x] Deployment scripts (Base mainnet + addresses → `.env.example`)
- [ ] **Schemas**
  - [x] Define `ScanSubmission`, `AvailabilityCheck`, `Challenge`, `Resolution` encoders/decoders
  - [ ] Publish schema UIDs; add to README
- [ ] **Bundle Spec**
  - [ ] Finalize `manifest.json` schema + examples
  - [ ] Canonical IPFS add flags (cid-v1, raw-leaves, wrap-with-directory)
  - [x] `scanprint v0` canonicalizer + Merkle builder

## 🐍 Python Components
- [ ] **collector/**
  - [ ] CLI: target spec parsing (`asn:`, `cidr:`, profiles), run `nmap`, take screenshots (HTTP, RDP, VNC)
  - [x] Build UnixFS bundle + manifest; compute scanprint Merkle
  - [x] IPFS add + pin; submit `ScanSubmission` attestation
  - [ ] Dockerfile + publish to `ghcr.io/pierce403/nweb-collector`
- [ ] **hoarder/**
  - [ ] Tail wallet’s submissions; ensure pins; optional CAR export
  - [ ] Health metrics endpoint (prometheus/text)
- [ ] **indexer/**
  - [ ] Chain watcher (Base RPC), filter schema UID
  - [ ] IPFS fetch, verify manifest/merkle, parse to Postgres
  - [ ] Schema: `submissions`, `records`, views (`latest_open`)
- [ ] **slasher/**
  - [ ] Multi-gateway probes, native IPFS probe
  - [ ] Heuristics (attempts, majority failure)
  - [ ] File `AvailabilityCheck` + `Challenge` attestations
  - [ ] `processTimeout` helper script (after 72h)

## 🌐 Node/TS Apps
- [ ] **analyst/**
  - [ ] Next.js + API routes → Postgres
  - [ ] Pages: search, IP view, ASN view, submission details, settings/health
  - [ ] Diff visualizations (service/version changes)
- [ ] **dispatcher/**
  - [x] `/getwork` endpoint (open/public)
  - [x] Analyst-submitted domain priority queue
  - [ ] File/CID-backed target lists

## 🧪 Test & CI
- [ ] Local dev: seed with a **sample bundle** + a **dummy attestation** (testnet fork)
- [x] Contract unit tests (Foundry)
- [ ] Indexer integration tests (containers for IPFS+PG)
- [ ] Lint/format hooks (ruff, black, eslint, prettier)

## 📄 Docs & Ops
- [ ] Fill in **CONTRIBUTING.md**, **CODE_OF_CONDUCT.md**
- [x] Add **.env.example** with all placeholders
- [ ] Add **docker-compose.yml** (optional path) for ipfs+pg+analyst local
- [ ] Generate **CSV export** for payouts/claims in analyst
- [ ] Publish **deny/opt-out list** process

## 🔮 Nice-to-haves
- [ ] Reputation visualization in analyst
- [ ] “Value” heuristic for archival pinning
- [ ] Optional redaction pipeline for assets
- [ ] Hardware wallet signing flow for collector
