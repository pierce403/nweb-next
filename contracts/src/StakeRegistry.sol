// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/interfaces/IERC20.sol";

/// @title StakeRegistry - Manages GST staking and quota allocation
/// @notice Handles stake deposits, withdrawals, and quota calculations for collectors
contract StakeRegistry {
    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 lastClaimTime;
        uint256 reputation;
    }

    IERC20 public gstToken;
    address public owner;

    mapping(address => StakeInfo) public stakes;
    mapping(address => bool) public slashableAddresses;

    // Constants for quota calculation
    uint256 public constant MIN_STAKE = 100 * 10**18; // 100 GST minimum
    uint256 public constant MAX_REP_FACTOR = 5; // Maximum reputation multiplier

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Slashed(address indexed user, uint256 amount);
    event ReputationUpdated(address indexed user, uint256 newReputation);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor(address _gstToken) {
        gstToken = IERC20(_gstToken);
        owner = msg.sender;
    }

    /// @notice Stake GST tokens to earn quota
    /// @param amount Amount of GST to stake
    function stake(uint256 amount) external {
        require(amount >= MIN_STAKE, "Stake amount below minimum");
        require(gstToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        StakeInfo storage userStake = stakes[msg.sender];
        userStake.amount += amount;

        if (userStake.startTime == 0) {
            userStake.startTime = block.timestamp;
            userStake.lastClaimTime = block.timestamp;
        }

        slashableAddresses[msg.sender] = true;
        emit Staked(msg.sender, amount);
    }

    /// @notice Withdraw staked GST tokens
    /// @param amount Amount to withdraw
    function withdraw(uint256 amount) external {
        StakeInfo storage userStake = stakes[msg.sender];
        require(userStake.amount >= amount, "Insufficient staked amount");
        require(gstToken.transfer(msg.sender, amount), "Transfer failed");

        userStake.amount -= amount;

        if (userStake.amount == 0) {
            slashableAddresses[msg.sender] = false;
        }

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Slash a user's stake (called by SlashRouter)
    /// @param user Address to slash
    /// @param amount Amount to slash
    function slash(address user, uint256 amount) external onlyOwner {
        StakeInfo storage userStake = stakes[user];
        require(userStake.amount >= amount, "Insufficient stake to slash");
        require(slashableAddresses[user], "Address not slashable");

        userStake.amount -= amount;
        require(gstToken.transfer(owner, amount), "Transfer failed");

        if (userStake.amount == 0) {
            slashableAddresses[user] = false;
        }

        emit Slashed(user, amount);
    }

    /// @notice Update user reputation (based on successful submissions)
    /// @param user Address to update
    /// @param delta Change in reputation (can be negative)
    function updateReputation(address user, int256 delta) external onlyOwner {
        StakeInfo storage userStake = stakes[user];
        if (delta >= 0) {
            userStake.reputation += uint256(delta);
        } else {
            uint256 absDelta = uint256(-delta);
            if (userStake.reputation >= absDelta) {
                userStake.reputation -= absDelta;
            } else {
                userStake.reputation = 0;
            }
        }
        emit ReputationUpdated(user, userStake.reputation);
    }

    /// @notice Calculate quota for a user based on stake and reputation
    /// @param user Address to calculate quota for
    /// @return quotaUnits Available quota units
    function calculateQuota(address user) public view returns (uint256) {
        StakeInfo memory userStake = stakes[user];
        if (userStake.amount == 0) {
            return 0;
        }

        // Base quota from stake: sqrt(stake / MIN_STAKE)
        uint256 stakeUnits = sqrt(userStake.amount / MIN_STAKE);

        // Reputation factor (capped at MAX_REP_FACTOR)
        uint256 repFactor = userStake.reputation / 100; // Assume rep is in basis points
        if (repFactor > MAX_REP_FACTOR) {
            repFactor = MAX_REP_FACTOR;
        }

        return stakeUnits * (1 + repFactor);
    }

    /// @notice Get stake info for a user
    /// @param user Address to query
    function getStakeInfo(address user) external view returns (StakeInfo memory) {
        return stakes[user];
    }

    /// @notice Check if user can perform an action based on quota
    /// @param user Address to check
    /// @param cost Quota cost of the action
    function hasQuota(address user, uint256 cost) external view returns (bool) {
        return calculateQuota(user) >= cost;
    }

    /// @notice Square root function for quota calculation
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
}
