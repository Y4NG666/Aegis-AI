// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AegisAIGuardian {
    address public owner;

    struct GuardianState {
        bool active;
        uint256 lastRiskScore;
        uint256 lastUpdated;
        string latestSummary;
    }

    mapping(address => GuardianState) private guardianStates;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event IncidentLogged(
        address indexed account,
        uint256 riskScore,
        string summary,
        bool active,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Aegis: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Aegis: invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function updateGuardianState(
        address account,
        uint256 riskScore,
        string calldata summary,
        bool active
    ) external onlyOwner {
        require(account != address(0), "Aegis: invalid account");
        require(riskScore <= 100, "Aegis: risk score out of range");

        guardianStates[account] = GuardianState({
            active: active,
            lastRiskScore: riskScore,
            lastUpdated: block.timestamp,
            latestSummary: summary
        });

        emit IncidentLogged(account, riskScore, summary, active, block.timestamp);
    }

    function getGuardianState(address account) external view returns (GuardianState memory) {
        return guardianStates[account];
    }
}
