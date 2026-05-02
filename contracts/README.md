# nweb Contracts

Foundry contracts for the nweb attestation, staking, submission, and challenge flow.

## Contracts

- `Attestor`: lightweight schema registry and attestation store.
- `StakeRegistry`: GST stake accounting and quota calculation.
- `SubmissionRouter`: validates and records `ScanSubmission` attestations.
- `SlashRouter`: files challenges, accepts resolutions, and processes timeout slashing.
- `GST`: local/test ERC-20 used when a bridged GST address is not supplied.

## Build And Test

```bash
forge build
forge test
```

## Deploy

Set `RPC_URL` and a deployer key, plus `GST_TOKEN_ADDRESS` if you are using an existing GST token. If `GST_TOKEN_ADDRESS` is omitted, the script deploys the local `GST` contract.

```bash
forge script script/DeployNweb.s.sol:DeployNweb \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --verify
```

The script deploys the routers, registers the four protocol schemas, wires schema UIDs into the routers, transfers `StakeRegistry` ownership to `SlashRouter`, and prints the values to copy into `.env`.

Required output values:

```env
GST_TOKEN_ADDRESS=
ATTESTOR_ADDRESS=
STAKE_REGISTRY_ADDRESS=
SUBMISSION_ROUTER_ADDRESS=
SLASH_ROUTER_ADDRESS=
SCHEMA_UID_SCAN_SUBMISSION=
SCHEMA_UID_AVAILABILITY_CHECK=
SCHEMA_UID_CHALLENGE=
SCHEMA_UID_RESOLUTION=
```
