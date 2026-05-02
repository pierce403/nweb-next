# nweb Collector

Runs `nmap`, builds an nweb UnixFS bundle, optionally adds it to IPFS, and optionally submits a `ScanSubmission` attestation.

## Setup

```bash
cd collector
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
```

`nmap` must be installed on the host.

## Local Dry Run

This scans localhost, writes a bundle under `./runs/local`, and does not touch IPFS or chain:

```bash
uv run nweb-collector \
  --targets ip:127.0.0.1 \
  --profile quick \
  --vantage local/dev \
  --work-dir ./runs/local \
  --dry-run
```

The bundle contains:

- `manifest.json`
- `scanprint/scanprint.v0.jsonl`
- `raw/nmap.xml`

## Fetch Work From A Dispatcher

Start the dispatcher, then let the collector pull random IPv4 work and index it locally:

```bash
../run-collector.sh
```

Useful root-script modes:

```bash
../run-collector.sh --ip 8.8.8.8
../run-collector.sh --target host:example.com --ping
../run-collector.sh --continuous --interval 30
../run-collector.sh --local
../run-collector.sh --dry-run --ip 1.1.1.1
```

By default, `../run-collector.sh` asks the dispatcher for random IPv4 work and passes `-Pn` to nmap. Use `--local` for the safe loopback work item, or `--ping` to allow normal nmap host discovery.

Use `--work-id <id>` to select a specific returned item. A dispatcher-provided profile is used unless `--profile` is passed explicitly.

The root script indexes into the local Analyst API by default. To use the CLI directly:

```bash
uv run nweb-collector \
  --dispatcher-url http://127.0.0.1:7778 \
  --work-label local \
  --work-dir ./runs/dispatcher-local \
  --no-ping \
  --index-url http://127.0.0.1:3000/api/submit
```

## Add To IPFS

Start Kubo first, then:

```bash
IPFS_API=http://127.0.0.1:5001 \
uv run nweb-collector \
  --targets ip:127.0.0.1 \
  --profile quick \
  --vantage local/dev \
  --work-dir ./runs/local-ipfs \
  --ipfs-add
```

## Submit On-Chain

This requires deployed contract addresses, a funded/staked collector wallet, and enough gas on the target chain:

```bash
RPC_URL=... \
PRIVATE_KEY=... \
ATTESTOR_ADDRESS=... \
SUBMISSION_ROUTER_ADDRESS=... \
SCHEMA_UID_SCAN_SUBMISSION=... \
IPFS_API=http://127.0.0.1:5001 \
uv run nweb-collector \
  --targets cidr:127.0.0.1/32 \
  --profile quick \
  --vantage local/dev \
  --work-dir ./runs/local-submit \
  --ipfs-add \
  --submit
```

For local Anvil/dev testing without IPFS installed, pass an existing or placeholder CID:

```bash
uv run nweb-collector \
  --targets ip:127.0.0.1 \
  --profile quick \
  --vantage local/dev \
  --work-dir ./runs/local-submit \
  --cid bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi \
  --submit
```

Supported target prefixes today: `ip:`, `host:`, and `cidr:`. `asn:` expansion is still pending.
