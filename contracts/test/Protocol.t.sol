// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {Attestor} from "../src/Attestor.sol";
import {GST} from "../src/GST.sol";
import {SlashRouter} from "../src/SlashRouter.sol";
import {StakeRegistry} from "../src/StakeRegistry.sol";
import {SubmissionRouter} from "../src/SubmissionRouter.sol";

contract ProtocolTest is Test {
    uint256 internal constant GST_AMOUNT = 1_000 ether;
    uint256 internal constant STAKE_AMOUNT = 500 ether;

    address internal collector = address(0xC011EC70);
    address internal challenger = address(0xC0FFEE);

    Attestor internal attestor;
    GST internal gst;
    StakeRegistry internal stakeRegistry;
    SubmissionRouter internal submissionRouter;
    SlashRouter internal slashRouter;

    bytes32 internal scanSchemaUID;
    bytes32 internal challengeSchemaUID;
    bytes32 internal resolutionSchemaUID;
    bytes32 internal jobId;
    bytes32 internal merkleRoot;

    function setUp() public {
        gst = new GST("nweb GST", "GST", 18);
        stakeRegistry = new StakeRegistry(address(gst));
        attestor = new Attestor();
        submissionRouter = new SubmissionRouter(address(attestor), address(stakeRegistry));
        slashRouter = new SlashRouter(address(attestor), address(stakeRegistry), address(submissionRouter));

        scanSchemaUID = attestor.registerSchema(
            "address subject,bytes32 jobId,string namespace,string datasetType,string cid,bytes32 merkleRoot,string targetSpecCid,uint64 startedAt,uint64 finishedAt,string tool,string version,string vantage,string manifestSha256,bytes extra",
            address(0),
            true
        );
        challengeSchemaUID = attestor.registerSchema(
            "bytes32 jobId,string cid,bytes32 reasonCode,string evidenceCid,uint64 graceEndsAt", address(0), true
        );
        resolutionSchemaUID = attestor.registerSchema(
            "bytes32 challengeId,bool slash,uint256 slashAmount,string notes,string newCid", address(0), true
        );

        submissionRouter.setSchemaUIDs(scanSchemaUID, challengeSchemaUID, resolutionSchemaUID);
        slashRouter.setSchemaUIDs(challengeSchemaUID, resolutionSchemaUID);
        stakeRegistry.transferOwnership(address(slashRouter));

        gst.mint(collector, GST_AMOUNT);
        vm.prank(collector);
        gst.approve(address(stakeRegistry), STAKE_AMOUNT);
        vm.prank(collector);
        stakeRegistry.stake(STAKE_AMOUNT);

        jobId = keccak256("job:cloudflare-top1k");
        merkleRoot = keccak256("scanprint-root");
    }

    function testSubmitScanRecordsDecodedAttestationData() public {
        bytes memory data = _scanSubmissionData("nmap-top1k");

        vm.prank(collector);
        bytes32 attestationUID = attestor.attest(collector, scanSchemaUID, 0, data);

        vm.prank(collector);
        submissionRouter.submitScan(attestationUID, keccak256(data));

        SubmissionRouter.Submission memory submission = submissionRouter.getSubmission(attestationUID);
        assertEq(submission.uid, attestationUID);
        assertEq(submission.submitter, collector);
        assertEq(submission.jobId, jobId);
        assertEq(submission.namespace, "nweb/base-mainnet");
        assertEq(submission.datasetType, "nmap-top1k");
        assertEq(submission.cid, "bafybeigdyrzt");
        assertEq(submission.merkleRoot, merkleRoot);
        assertEq(submission.targetSpecCid, "bafy-target-spec");
        assertEq(submission.startedAt, 1_700_000_000);
        assertEq(submission.finishedAt, 1_700_000_900);
        assertEq(submission.tool, "nmap");
        assertEq(submission.version, "7.95");
        assertEq(submission.vantage, "AS1234/us-west-2");
        assertEq(submission.manifestSha256, "sha256:manifest");
        assertEq(submission.extra, bytes('{"profile":"top-1000"}'));
        assertGt(submission.timestamp, 0);
        assertTrue(submissionRouter.isSubmissionValid(attestationUID));
    }

    function testSchemaUIDsAreDeterministic() public {
        bytes32 expected = keccak256(
            abi.encode(
                "address subject,bytes32 jobId,string namespace,string datasetType,string cid,bytes32 merkleRoot,string targetSpecCid,uint64 startedAt,uint64 finishedAt,string tool,string version,string vantage,string manifestSha256,bytes extra",
                address(0),
                true
            )
        );

        assertEq(scanSchemaUID, expected);
    }

    function testSubmitScanRejectsUnknownDatasetType() public {
        bytes memory data = _scanSubmissionData("zgrab-full");

        vm.prank(collector);
        bytes32 attestationUID = attestor.attest(collector, scanSchemaUID, 0, data);

        vm.prank(collector);
        vm.expectRevert("Unknown dataset type");
        submissionRouter.submitScan(attestationUID, keccak256(data));
    }

    function testChallengeResolutionStoresDecodedData() public {
        bytes32 submissionUID = _recordSubmission();
        bytes memory challengeData = _challengeData(submissionUID);

        vm.prank(challenger);
        bytes32 challengeUID = attestor.attest(challenger, challengeSchemaUID, 0, challengeData);

        vm.prank(challenger);
        slashRouter.fileChallenge(challengeUID);

        SlashRouter.Challenge memory challenge = slashRouter.getChallenge(challengeUID);
        assertEq(challenge.uid, challengeUID);
        assertEq(challenge.jobId, submissionUID);
        assertEq(challenge.cid, "bafybeigdyrzt");
        assertEq(challenge.reasonCode, keccak256("CID_UNAVAILABLE"));
        assertEq(challenge.evidenceCid, "bafy-evidence");
        assertEq(challenge.challenger, challenger);
        assertEq(challenge.graceEndsAt, block.timestamp + slashRouter.GRACE_PERIOD());

        bytes memory resolutionData = abi.encode(challengeUID, false, uint256(0), "repinned", "bafy-new-cid");
        vm.prank(collector);
        bytes32 resolutionUID = attestor.attest(collector, resolutionSchemaUID, 0, resolutionData);

        vm.prank(collector);
        slashRouter.resolveChallenge(resolutionUID);

        challenge = slashRouter.getChallenge(challengeUID);
        assertTrue(challenge.resolved);
        assertFalse(challenge.slash);
        assertEq(challenge.slashAmount, 0);
        assertEq(challenge.notes, "repinned");
        assertEq(challenge.newCid, "bafy-new-cid");
    }

    function testProcessTimeoutSlashesTenPercent() public {
        bytes32 submissionUID = _recordSubmission();
        bytes memory challengeData = _challengeData(submissionUID);

        vm.prank(challenger);
        bytes32 challengeUID = attestor.attest(challenger, challengeSchemaUID, 0, challengeData);

        vm.prank(challenger);
        slashRouter.fileChallenge(challengeUID);

        vm.warp(block.timestamp + slashRouter.GRACE_PERIOD());
        slashRouter.processTimeout(challengeUID);

        StakeRegistry.StakeInfo memory stakeInfo = stakeRegistry.getStakeInfo(collector);
        assertEq(stakeInfo.amount, 450 ether);
        assertEq(gst.balanceOf(challenger), 25 ether);
        assertEq(gst.balanceOf(address(slashRouter)), 25 ether);

        SlashRouter.Challenge memory challenge = slashRouter.getChallenge(challengeUID);
        assertTrue(challenge.resolved);
        assertTrue(challenge.slash);
        assertEq(challenge.slashAmount, 50 ether);
    }

    function _recordSubmission() internal returns (bytes32) {
        bytes memory data = _scanSubmissionData("nmap-top1k");

        vm.prank(collector);
        bytes32 attestationUID = attestor.attest(collector, scanSchemaUID, 0, data);

        vm.prank(collector);
        submissionRouter.submitScan(attestationUID, keccak256(data));

        return attestationUID;
    }

    function _scanSubmissionData(string memory datasetType) internal view returns (bytes memory) {
        return abi.encode(
            collector,
            jobId,
            "nweb/base-mainnet",
            datasetType,
            "bafybeigdyrzt",
            merkleRoot,
            "bafy-target-spec",
            uint64(1_700_000_000),
            uint64(1_700_000_900),
            "nmap",
            "7.95",
            "AS1234/us-west-2",
            "sha256:manifest",
            bytes('{"profile":"top-1000"}')
        );
    }

    function _challengeData(bytes32 submissionUID) internal pure returns (bytes memory) {
        return abi.encode(submissionUID, "bafybeigdyrzt", keccak256("CID_UNAVAILABLE"), "bafy-evidence", uint64(0));
    }
}
