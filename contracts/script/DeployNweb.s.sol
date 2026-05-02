// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console2} from "forge-std/Script.sol";
import {Attestor} from "../src/Attestor.sol";
import {GST} from "../src/GST.sol";
import {SlashRouter} from "../src/SlashRouter.sol";
import {StakeRegistry} from "../src/StakeRegistry.sol";
import {SubmissionRouter} from "../src/SubmissionRouter.sol";

contract DeployNweb is Script {
    string internal constant SCAN_SUBMISSION_SCHEMA =
        "address subject,bytes32 jobId,string namespace,string datasetType,string cid,bytes32 merkleRoot,string targetSpecCid,uint64 startedAt,uint64 finishedAt,string tool,string version,string vantage,string manifestSha256,bytes extra";
    string internal constant AVAILABILITY_CHECK_SCHEMA =
        "string cid,bool available,uint8 attempts,uint8 gatewaysOk,bytes32 fetchDigest,uint64 checkedAt";
    string internal constant CHALLENGE_SCHEMA =
        "bytes32 jobId,string cid,bytes32 reasonCode,string evidenceCid,uint64 graceEndsAt";
    string internal constant RESOLUTION_SCHEMA =
        "bytes32 challengeId,bool slash,uint256 slashAmount,string notes,string newCid";

    function run() external {
        address gstToken = vm.envOr("GST_TOKEN_ADDRESS", address(0));

        vm.startBroadcast();

        if (gstToken == address(0)) {
            gstToken = address(new GST("nweb GST", "GST", 18));
        }

        Attestor attestor = new Attestor();
        StakeRegistry stakeRegistry = new StakeRegistry(gstToken);
        SubmissionRouter submissionRouter = new SubmissionRouter(address(attestor), address(stakeRegistry));
        SlashRouter slashRouter = new SlashRouter(address(attestor), address(stakeRegistry), address(submissionRouter));

        bytes32 scanSubmissionSchemaUID = attestor.registerSchema(SCAN_SUBMISSION_SCHEMA, address(0), true);
        bytes32 availabilityCheckSchemaUID = attestor.registerSchema(AVAILABILITY_CHECK_SCHEMA, address(0), true);
        bytes32 challengeSchemaUID = attestor.registerSchema(CHALLENGE_SCHEMA, address(0), true);
        bytes32 resolutionSchemaUID = attestor.registerSchema(RESOLUTION_SCHEMA, address(0), true);

        submissionRouter.setSchemaUIDs(scanSubmissionSchemaUID, challengeSchemaUID, resolutionSchemaUID);
        slashRouter.setSchemaUIDs(challengeSchemaUID, resolutionSchemaUID);
        stakeRegistry.transferOwnership(address(slashRouter));

        vm.stopBroadcast();

        console2.log("GST_TOKEN_ADDRESS=", gstToken);
        console2.log("ATTESTOR_ADDRESS=", address(attestor));
        console2.log("STAKE_REGISTRY_ADDRESS=", address(stakeRegistry));
        console2.log("SUBMISSION_ROUTER_ADDRESS=", address(submissionRouter));
        console2.log("SLASH_ROUTER_ADDRESS=", address(slashRouter));
        console2.logBytes32(scanSubmissionSchemaUID);
        console2.log("SCHEMA_UID_SCAN_SUBMISSION printed above");
        console2.logBytes32(availabilityCheckSchemaUID);
        console2.log("SCHEMA_UID_AVAILABILITY_CHECK printed above");
        console2.logBytes32(challengeSchemaUID);
        console2.log("SCHEMA_UID_CHALLENGE printed above");
        console2.logBytes32(resolutionSchemaUID);
        console2.log("SCHEMA_UID_RESOLUTION printed above");
    }
}
