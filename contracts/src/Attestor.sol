// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/interfaces/IERC20.sol";

/// @title Attestor - Lightweight EAS-compatible attestation system
/// @notice Handles attestation creation and schema management for nweb
contract Attestor {
    struct Attestation {
        address attester;
        address subject;
        bytes32 schemaUID;
        uint64 timestamp;
        uint64 expirationTime;
        bool revoked;
        bytes32 uid;
        bytes data;
    }

    struct Schema {
        string schema;
        address resolver;
        bool revocable;
        bytes32 uid;
    }

    mapping(bytes32 => Schema) public schemas;
    mapping(bytes32 => Attestation) public attestations;
    mapping(address => mapping(bytes32 => bool)) public revokedAttestations;

    bytes32[] public schemaUIDs;
    bytes32[] public attestationUIDs;

    event SchemaRegistered(bytes32 indexed uid, address indexed registerer);
    event AttestationMade(bytes32 indexed uid, address indexed attester, address indexed subject);
    event AttestationRevoked(bytes32 indexed uid, address indexed revoker);

    /// @notice Register a new schema
    /// @param schema The schema string (EIP-712 format)
    /// @param resolver Address that can resolve attestations (optional)
    /// @param revocable Whether attestations using this schema can be revoked
    function registerSchema(
        string calldata schema,
        address resolver,
        bool revocable
    ) external returns (bytes32) {
        bytes32 uid = keccak256(abi.encodePacked(schema, resolver, revocable, block.timestamp));
        require(schemas[uid].uid == bytes32(0), "Schema already exists");

        schemas[uid] = Schema({
            schema: schema,
            resolver: resolver,
            revocable: revocable,
            uid: uid
        });

        schemaUIDs.push(uid);
        emit SchemaRegistered(uid, msg.sender);
        return uid;
    }

    /// @notice Create an attestation
    /// @param subject The subject of the attestation
    /// @param schemaUID The schema UID to use
    /// @param expirationTime When the attestation expires (0 for no expiration)
    /// @param data The attestation data
    function attest(
        address subject,
        bytes32 schemaUID,
        uint64 expirationTime,
        bytes calldata data
    ) external returns (bytes32) {
        require(schemas[schemaUID].uid != bytes32(0), "Schema not registered");

        bytes32 uid = keccak256(abi.encodePacked(
            msg.sender,
            subject,
            schemaUID,
            block.timestamp,
            data
        ));

        require(attestations[uid].uid == bytes32(0), "Attestation already exists");

        attestations[uid] = Attestation({
            attester: msg.sender,
            subject: subject,
            schemaUID: schemaUID,
            timestamp: uint64(block.timestamp),
            expirationTime: expirationTime,
            revoked: false,
            uid: uid,
            data: data
        });

        attestationUIDs.push(uid);
        emit AttestationMade(uid, msg.sender, subject);
        return uid;
    }

    /// @notice Revoke an attestation
    /// @param uid The attestation UID to revoke
    function revoke(bytes32 uid) external {
        Attestation storage attestation = attestations[uid];
        require(attestation.uid != bytes32(0), "Attestation not found");
        require(attestation.attester == msg.sender, "Only attester can revoke");
        require(schemas[attestation.schemaUID].revocable, "Schema not revocable");
        require(!attestation.revoked, "Already revoked");

        attestation.revoked = true;
        revokedAttestations[attestation.attester][uid] = true;
        emit AttestationRevoked(uid, msg.sender);
    }

    /// @notice Get attestation details
    function getAttestation(bytes32 uid) external view returns (Attestation memory) {
        return attestations[uid];
    }

    /// @notice Get schema details
    function getSchema(bytes32 uid) external view returns (Schema memory) {
        return schemas[uid];
    }

    /// @notice Get all schema UIDs
    function getSchemas() external view returns (bytes32[] memory) {
        return schemaUIDs;
    }

    /// @notice Get all attestation UIDs
    function getAttestations() external view returns (bytes32[] memory) {
        return attestationUIDs;
    }
}
