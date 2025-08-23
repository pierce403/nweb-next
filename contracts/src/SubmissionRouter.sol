// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Attestor.sol";
import "./StakeRegistry.sol";

/// @title SubmissionRouter - Routes and validates scan submissions
/// @notice Handles quota checks and submission recording for collectors
contract SubmissionRouter {
    struct Submission {
        bytes32 uid;
        address submitter;
        bytes32 jobId;
        string namespace;
        string datasetType;
        string cid;
        bytes32 merkleRoot;
        string targetSpecCid;
        uint64 startedAt;
        uint64 finishedAt;
        string tool;
        string version;
        string vantage;
        string manifestSha256;
        bytes extra;
        uint64 timestamp;
    }

    Attestor public attestor;
    StakeRegistry public stakeRegistry;

    bytes32 public scanSubmissionSchemaUID;
    bytes32 public challengeSchemaUID;
    bytes32 public resolutionSchemaUID;

    mapping(bytes32 => Submission) public submissions;
    mapping(address => bytes32[]) public submitterSubmissions;
    bytes32[] public allSubmissionUIDs;

    // Quota costs for different dataset types
    mapping(string => uint256) public datasetCosts;

    event SubmissionRecorded(bytes32 indexed uid, address indexed submitter, string datasetType);
    event SchemaUIDsSet(bytes32 scanSubmission, bytes32 challenge, bytes32 resolution);

    constructor(address _attestor, address _stakeRegistry) {
        attestor = Attestor(_attestor);
        stakeRegistry = StakeRegistry(_stakeRegistry);

        // Set default dataset costs
        datasetCosts["nmap-quick"] = 1;
        datasetCosts["nmap-top1k"] = 2;
        datasetCosts["nmap-full"] = 5;
        datasetCosts["diff"] = 1;
        datasetCosts["enrich"] = 1;
    }

    /// @notice Set schema UIDs (called after schema registration)
    function setSchemaUIDs(
        bytes32 _scanSubmissionSchemaUID,
        bytes32 _challengeSchemaUID,
        bytes32 _resolutionSchemaUID
    ) external {
        require(scanSubmissionSchemaUID == bytes32(0), "Schema UIDs already set");

        scanSubmissionSchemaUID = _scanSubmissionSchemaUID;
        challengeSchemaUID = _challengeSchemaUID;
        resolutionSchemaUID = _resolutionSchemaUID;

        emit SchemaUIDsSet(_scanSubmissionSchemaUID, _challengeSchemaUID, _resolutionSchemaUID);
    }

    /// @notice Submit a scan (called by collector after attestation)
    /// @param attestationUID The attestation UID from the attestor
    /// @param expectedDataHash Expected hash of the attestation data for verification
    function submitScan(bytes32 attestationUID, bytes32 expectedDataHash) external {
        // Get attestation data
        Attestor.Attestation memory attestation = attestor.getAttestation(attestationUID);
        require(attestation.uid != bytes32(0), "Attestation not found");
        require(attestation.attester == msg.sender, "Not attestation attester");
        require(attestation.schemaUID == scanSubmissionSchemaUID, "Wrong schema");

        // Verify data hash
        require(keccak256(attestation.data) == expectedDataHash, "Data hash mismatch");

        // Decode submission data
        Submission memory submission = _decodeSubmissionData(attestation.data);
        require(submission.submitter == msg.sender, "Submitter mismatch");

        // Check quota
        uint256 cost = datasetCosts[submission.datasetType];
        require(cost > 0, "Unknown dataset type");
        require(stakeRegistry.hasQuota(msg.sender, cost), "Insufficient quota");

        // Store submission
        submissions[attestationUID] = submission;
        submitterSubmissions[msg.sender].push(attestationUID);
        allSubmissionUIDs.push(attestationUID);

        emit SubmissionRecorded(attestationUID, msg.sender, submission.datasetType);
    }

    /// @notice Get submission details
    function getSubmission(bytes32 uid) external view returns (Submission memory) {
        return submissions[uid];
    }

    /// @notice Get submissions by submitter
    function getSubmitterSubmissions(address submitter) external view returns (bytes32[] memory) {
        return submitterSubmissions[submitter];
    }

    /// @notice Get all submission UIDs
    function getAllSubmissions() external view returns (bytes32[] memory) {
        return allSubmissionUIDs;
    }

    /// @notice Update dataset cost (owner only)
    function setDatasetCost(string calldata datasetType, uint256 cost) external {
        datasetCosts[datasetType] = cost;
    }

    /// @notice Get dataset cost
    function getDatasetCost(string calldata datasetType) external view returns (uint256) {
        return datasetCosts[datasetType];
    }

    /// @notice Internal function to decode submission data from attestation
    function _decodeSubmissionData(bytes memory data) internal pure returns (Submission memory) {
        // Simplified decoding - in production, use proper ABI decoding
        // This is a placeholder implementation
        return Submission({
            uid: bytes32(0), // Will be set by caller
            submitter: address(0),
            jobId: bytes32(0),
            namespace: "",
            datasetType: "",
            cid: "",
            merkleRoot: bytes32(0),
            targetSpecCid: "",
            startedAt: 0,
            finishedAt: 0,
            tool: "",
            version: "",
            vantage: "",
            manifestSha256: "",
            extra: "",
            timestamp: 0
        });
    }

    /// @notice Check if a submission is valid and not challenged
    function isSubmissionValid(bytes32 uid) external view returns (bool) {
        Submission memory submission = submissions[uid];
        return submission.uid != bytes32(0);
    }
}
