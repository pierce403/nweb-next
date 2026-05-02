# nweb Dispatcher

The dispatcher publishes target suggestions for collectors. It does not scan, attest, store bundles, or decide truth. It is an off-chain coordination service.

## Run

```bash
cd dispatcher
npm install
npm run dev
```

By default it listens on `http://127.0.0.1:7778`.

From the repository root, this is equivalent:

```bash
./run-dispatcher.sh
```

## Endpoints

### `GET /health`

Returns service health.

### `GET /getwork`

Returns active work items. Analyst-submitted domain targets are returned before random IPv4 or static work.

Optional query parameters:

- `profile=quick`
- `label=local`
- `limit=10`
- `random=ipv4`

Example:

```bash
curl 'http://127.0.0.1:7778/getwork?profile=quick&limit=1'
```

Random globally routable IPv4 target:

```bash
curl 'http://127.0.0.1:7778/getwork?random=ipv4&profile=quick&limit=1'
```

Random mode excludes private, loopback, link-local, multicast, documentation, benchmarking, and reserved IPv4 ranges. Collector operators are still responsible for lawful scanning and polite rates.

### `GET /targets`

Returns the persisted Analyst priority target queue.

### `POST /targets`

Adds or updates a prioritized domain target.

```bash
curl -X POST 'http://127.0.0.1:7778/targets' \
  -H 'content-type: application/json' \
  --data '{"domain":"example.com","profile":"quick","priority":1000}'
```

Domains must be DNS hostnames without a scheme, path, or port. The dispatcher converts them into `host:example.com` work items.

Response shape:

```json
{
  "version": 1,
  "dispatcher": "local-dev",
  "generatedAt": "2026-05-02T00:00:00.000Z",
  "count": 1,
  "work": [
    {
      "id": "local-loopback-quick",
      "targets": ["ip:127.0.0.1"],
      "profile": "quick",
      "withAssets": false,
      "priority": 100
    }
  ]
}
```

## Configuration

Environment variables:

- `PORT`: listen port, default `7778`
- `HOST`: listen host, default `127.0.0.1`
- `DISPATCHER_WORK_FILE`: path to a JSON work file, default `./work/default.json`
- `DISPATCHER_TARGETS_FILE`: path to the Analyst priority queue, default `./work/targets.json`

## Work File

Work items use collector target syntax:

- `ip:127.0.0.1`
- `host:example.com`
- `cidr:203.0.113.0/24`
- `asn:AS13335`
- `cid:bafy...`
- `file:/path/to/targets.txt`

Collectors are responsible for deciding whether they are allowed to scan a target from their network and jurisdiction.
