// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Attestor.sol";
import "./StakeRegistry.sol";
import "./SubmissionRouter.sol";

/// @title SlashRouter - Handles challenge resolution and slashing
/// @notice Immutable slashing rules: 72h grace, 10% slash, 50/50 bounty split
contract SlashRouter {
    struct Challenge {
        bytes32 uid;
        bytes32 jobId;
        string cid;
        bytes32 reasonCode;
        string evidenceCid;
        uint64 graceEndsAt;
        address challenger;
        bool resolved;
        bool slash;
        uint256 slashAmount;
        string notes;
        string newCid;
    }

    // Immutable parameters
    uint64 public constant GRACE_PERIOD = 72 hours;
    uint256 public constant SLASH_PERCENT = 10; // 10% of stake
    uint256 public constant CHALLENGER_BOUNTY_PERCENT = 50; // 50% of slashed amount
    uint256 public constant MIN_STAKE = 100 * 10**18; // 100 GST

    Attestor public attestor;
    StakeRegistry public stakeRegistry;
    SubmissionRouter public submissionRouter;

    bytes32 public challengeSchemaUID;
    bytes32 public resolutionSchemaUID;

    mapping(bytes32 => Challenge) public challenges;
    mapping(bytes32 => bytes32) public submissionChallenges; // submissionUID => challengeUID
    bytes32[] public allChallengeUIDs;

    event ChallengeFiled(bytes32 indexed uid, bytes32 indexed jobId, address indexed challenger);
    event ChallengeResolved(bytes32 indexed uid, bool slash, uint256 slashAmount);
    event Slashed(address indexed user, uint256 amount, address indexed challenger, uint256 bounty);

    constructor(
        address _attestor,
        address _stakeRegistry,
        address _submissionRouter
    ) {
        attestor = Attestor(_attestor);
        stakeRegistry = StakeRegistry(_stakeRegistry);
        submissionRouter = SubmissionRouter(_submissionRouter);
    }

    /// @notice Set schema UIDs
    function setSchemaUIDs(bytes32 _challengeSchemaUID, bytes32 _resolutionSchemaUID) external {
        require(challengeSchemaUID == bytes32(0), "Schema UIDs already set");
        challengeSchemaUID = _challengeSchemaUID;
        resolutionSchemaUID = _resolutionSchemaUID;
    }

    /// @notice File a challenge (called by slasher after attestation)
    /// @param attestationUID The challenge attestation UID
    function fileChallenge(bytes32 attestationUID) external {
        Attestor.Attestation memory attestation = attestor.getAttestation(attestationUID);
        require(attestation.uid != bytes32(0), "Attestation not found");
        require(attestation.attester == msg.sender, "Not attestation attester");
        require(attestation.schemaUID == challengeSchemaUID, "Wrong schema");

        Challenge memory challenge = _decodeChallengeData(attestation.data);
        require(challenge.uid != bytes32(0), "Invalid challenge data");

        // Verify the submission exists
        require(submissionRouter.isSubmissionValid(challenge.jobId), "Submission not found");

        // Check if already challenged
        require(submissionChallenges[challenge.jobId] == bytes32(0), "Already challenged");

        // Set grace period
        challenge.graceEndsAt = uint64(block.timestamp + GRACE_PERIOD);
        challenge.challenger = msg.sender;
        challenge.uid = attestationUID;

        challenges[attestationUID] = challenge;
        submissionChallenges[challenge.jobId] = attestationUID;
        allChallengeUIDs.push(attestationUID);

        emit ChallengeFiled(attestationUID, challenge.jobId, msg.sender);
    }

    /// @notice Resolve a challenge (called by submitter after resolution attestation)
    /// @param attestationUID The resolution attestation UID
    function resolveChallenge(bytes32 attestationUID) external {
        Attestor.Attestation memory attestation = attestor.getAttestation(attestationUID);
        require(attestation.uid != bytes32(0), "Attestation not found");
        require(attestation.attester == msg.sender, "Not attestation attester");
        require(attestation.schemaUID == resolutionSchemaUID, "Wrong schema");

        (bytes32 challengeId, bool slash, uint256 slashAmount, string memory notes, string memory newCid) =
            _decodeResolutionData(attestation.data);

        Challenge storage challenge = challenges[challengeId];
        require(challenge.uid != bytes32(0), "Challenge not found");
        require(!challenge.resolved, "Already resolved");

        // Verify submitter is resolving their own challenge
        SubmissionRouter.Submission memory submission = submissionRouter.getSubmission(challenge.jobId);
        require(submission.submitter == msg.sender, "Not submission owner");

        challenge.resolved = true;
        challenge.slash = slash;
        challenge.slashAmount = slashAmount;
        challenge.notes = notes;
        challenge.newCid = newCid;

        emit ChallengeResolved(challengeId, slash, slashAmount);
    }

    /// @notice Process timeout for unresolved challenge (anyone can call)
    /// @param challengeUID The challenge to process
    function processTimeout(bytes32 challengeUID) external {
        Challenge memory challenge = challenges[challengeUID];
        require(challenge.uid != bytes32(0), "Challenge not found");
        require(!challenge.resolved, "Already resolved");
        require(block.timestamp >= challenge.graceEndsAt, "Grace period not ended");

        // Get submission details
        SubmissionRouter.Submission memory submission = submissionRouter.getSubmission(challenge.jobId);

        // Calculate slash amount (10% of stake)
        StakeRegistry.StakeInfo memory stakeInfo = stakeRegistry.getStakeInfo(submission.submitter);
        uint256 slashAmount = (stakeInfo.amount * SLASH_PERCENT) / 100;

        // Ensure minimum stake is maintained
        if (stakeInfo.amount - slashAmount < MIN_STAKE && stakeInfo.amount > MIN_STAKE) {
            slashAmount = stakeInfo.amount - MIN_STAKE;
        }

        if (slashAmount > 0) {
            // Slash the user
            stakeRegistry.slash(submission.submitter, slashAmount);

            // Pay bounty to challenger
            uint256 bounty = (slashAmount * CHALLENGER_BOUNTY_PERCENT) / 100;
            if (bounty > 0) {
                // Note: In production, this would transfer GST tokens to challenger
                // For now, we just emit the event
                emit Slashed(submission.submitter, slashAmount, challenge.challenger, bounty);
            }
        }

        // Mark as resolved (with slash)
        challenges[challengeUID].resolved = true;
        challenges[challengeUID].slash = true;
        challenges[challengeUID].slashAmount = slashAmount;

        emit ChallengeResolved(challengeUID, true, slashAmount);
    }

    /// @notice Get challenge details
    function getChallenge(bytes32 uid) external view returns (Challenge memory) {
        return challenges[uid];
    }

    /// @notice Get challenge for a submission
    function getSubmissionChallenge(bytes32 submissionUID) external view returns (bytes32) {
        return submissionChallenges[submissionUID];
    }

    /// @notice Get all challenge UIDs
    function getAllChallenges() external view returns (bytes32[] memory) {
        return allChallengeUIDs;
    }

    /// @notice Check if a challenge can be processed
    function canProcessTimeout(bytes32 challengeUID) external view returns (bool) {
        Challenge memory challenge = challenges[challengeUID];
        return challenge.uid != bytes32(0) &&
               !challenge.resolved &&
               block.timestamp >= challenge.graceEndsAt;
    }

    /// @notice Internal function to decode challenge data
    function _decodeChallengeData(bytes memory data) internal pure returns (Challenge memory) {
        // Simplified decoding - in production, use proper ABI decoding
        return Challenge({
            uid: bytes32(0),
            jobId: bytes32(0),
            cid: "",
            reasonCode: bytes32(0),
            evidenceCid: "",
            graceEndsAt: 0,
            challenger: address(0),
            resolved: false,
            slash: false,
            slashAmount: 0,
            notes: "",
            newCid: ""
        });
    }

    /// @notice Internal function to decode resolution data
    function _decodeResolutionData(bytes memory data) internal pure returns (
        bytes32 challengeId,
        bool slash,
        uint256 slashAmount,
        string memory notes,
        string memory newCid
    ) {
        // Simplified decoding - in production, use proper ABI decoding
        return (bytes32(0), false, 0, "", "");
    }
}
