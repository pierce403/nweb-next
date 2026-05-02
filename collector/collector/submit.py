"""On-chain ScanSubmission submission."""

from dataclasses import dataclass

from eth_abi import encode
from eth_utils import keccak
from web3 import Web3

SCAN_SUBMISSION_ABI_TYPES = (
    "address",
    "bytes32",
    "string",
    "string",
    "string",
    "bytes32",
    "string",
    "uint64",
    "uint64",
    "string",
    "string",
    "string",
    "string",
    "bytes",
)

ATTESTOR_ABI = [
    {
        "inputs": [
            {"name": "subject", "type": "address"},
            {"name": "schemaUID", "type": "bytes32"},
            {"name": "expirationTime", "type": "uint64"},
            {"name": "data", "type": "bytes"},
        ],
        "name": "attest",
        "outputs": [{"name": "", "type": "bytes32"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "uid", "type": "bytes32"},
            {"indexed": True, "name": "attester", "type": "address"},
            {"indexed": True, "name": "subject", "type": "address"},
        ],
        "name": "AttestationMade",
        "type": "event",
    },
]

SUBMISSION_ROUTER_ABI = [
    {
        "inputs": [
            {"name": "attestationUID", "type": "bytes32"},
            {"name": "expectedDataHash", "type": "bytes32"},
        ],
        "name": "submitScan",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    }
]


@dataclass
class SubmissionResult:
    attestation_uid: str
    attest_tx: str
    submit_tx: str


def build_scan_submission_data(
    *,
    submitter: str,
    job_id: bytes,
    namespace: str,
    dataset_type: str,
    cid: str,
    merkle_root: str,
    target_spec_cid: str,
    started_at: int,
    finished_at: int,
    tool: str,
    version: str,
    vantage: str,
    manifest_sha256: str,
    extra: bytes,
) -> bytes:
    return encode(
        SCAN_SUBMISSION_ABI_TYPES,
        (
            bytes.fromhex(submitter.removeprefix("0x")),
            job_id,
            namespace,
            dataset_type,
            cid,
            bytes.fromhex(merkle_root.removeprefix("0x")),
            target_spec_cid,
            started_at,
            finished_at,
            tool,
            version,
            vantage,
            manifest_sha256,
            extra,
        ),
    )


def submit_scan(
    *,
    rpc_url: str,
    private_key: str,
    attestor_address: str,
    submission_router_address: str,
    schema_uid: str,
    data: bytes,
) -> SubmissionResult:
    web3 = Web3(Web3.HTTPProvider(rpc_url))
    account = web3.eth.account.from_key(private_key)
    attestor = web3.eth.contract(address=Web3.to_checksum_address(attestor_address), abi=ATTESTOR_ABI)
    router = web3.eth.contract(address=Web3.to_checksum_address(submission_router_address), abi=SUBMISSION_ROUTER_ABI)

    nonce = web3.eth.get_transaction_count(account.address)
    schema_uid_bytes = bytes.fromhex(schema_uid.removeprefix("0x"))

    attest_tx = attestor.functions.attest(account.address, schema_uid_bytes, 0, data).build_transaction(
        {
            "from": account.address,
            "nonce": nonce,
            "chainId": web3.eth.chain_id,
        }
    )
    signed_attest = account.sign_transaction(attest_tx)
    attest_hash = web3.eth.send_raw_transaction(signed_attest.raw_transaction)
    attest_receipt = web3.eth.wait_for_transaction_receipt(attest_hash)

    attestation_uid = None
    for log in attest_receipt["logs"]:
        if log["address"].lower() != attestor_address.lower():
            continue
        event = attestor.events.AttestationMade().process_log(log)
        attestation_uid = event["args"]["uid"]
        break
    if attestation_uid is None:
        raise RuntimeError("AttestationMade event not found in receipt")

    submit_tx = router.functions.submitScan(attestation_uid, keccak(data)).build_transaction(
        {
            "from": account.address,
            "nonce": nonce + 1,
            "chainId": web3.eth.chain_id,
        }
    )
    signed_submit = account.sign_transaction(submit_tx)
    submit_hash = web3.eth.send_raw_transaction(signed_submit.raw_transaction)
    web3.eth.wait_for_transaction_receipt(submit_hash)

    return SubmissionResult(
        attestation_uid="0x" + attestation_uid.hex(),
        attest_tx=attest_hash.hex(),
        submit_tx=submit_hash.hex(),
    )
