// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract RiskController {
    struct RiskParameters {
        uint256 maxPositionBps;
        uint256 liquidationThresholdBps;
        uint256 rebalanceThresholdBps;
    }

    address public owner;
    bool public paused;
    RiskParameters public parameters;

    mapping(address => bool) public authorizedContracts;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AuthorizedContractUpdated(address indexed account, bool allowed);
    event ProtocolPaused(address indexed triggeredBy);
    event ProtocolUnpaused(address indexed triggeredBy);
    event EmergencyWithdrawal(
        address indexed asset,
        address indexed recipient,
        uint256 amount,
        address indexed triggeredBy
    );
    event ParametersAdjusted(
        uint256 maxPositionBps,
        uint256 liquidationThresholdBps,
        uint256 rebalanceThresholdBps,
        address indexed triggeredBy
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "RiskController: caller is not the owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner || authorizedContracts[msg.sender],
            "RiskController: caller is not authorized"
        );
        _;
    }

    constructor(
        uint256 initialMaxPositionBps,
        uint256 initialLiquidationThresholdBps,
        uint256 initialRebalanceThresholdBps
    ) {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);

        _setParameters(
            initialMaxPositionBps,
            initialLiquidationThresholdBps,
            initialRebalanceThresholdBps
        );
    }

    receive() external payable {}

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "RiskController: invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setAuthorizedContract(address account, bool allowed) external onlyOwner {
        require(account != address(0), "RiskController: invalid address");
        require(account.code.length > 0, "RiskController: account is not a contract");

        authorizedContracts[account] = allowed;
        emit AuthorizedContractUpdated(account, allowed);
    }

    function pauseProtocol() external onlyAuthorized {
        require(!paused, "RiskController: protocol already paused");
        paused = true;
        emit ProtocolPaused(msg.sender);
    }

    function unpauseProtocol() external onlyOwner {
        require(paused, "RiskController: protocol not paused");
        paused = false;
        emit ProtocolUnpaused(msg.sender);
    }

    function emergencyWithdraw(address asset, address payable recipient, uint256 amount) external onlyAuthorized {
        require(recipient != address(0), "RiskController: invalid recipient");

        if (asset == address(0)) {
            require(address(this).balance >= amount, "RiskController: insufficient ETH");
            (bool success,) = recipient.call{value: amount}("");
            require(success, "RiskController: ETH transfer failed");
        } else {
            bool success = IERC20Minimal(asset).transfer(recipient, amount);
            require(success, "RiskController: token transfer failed");
        }

        emit EmergencyWithdrawal(asset, recipient, amount, msg.sender);
    }

    function adjustParameters(
        uint256 newMaxPositionBps,
        uint256 newLiquidationThresholdBps,
        uint256 newRebalanceThresholdBps
    ) external onlyAuthorized {
        _setParameters(
            newMaxPositionBps,
            newLiquidationThresholdBps,
            newRebalanceThresholdBps
        );

        emit ParametersAdjusted(
            newMaxPositionBps,
            newLiquidationThresholdBps,
            newRebalanceThresholdBps,
            msg.sender
        );
    }

    function _setParameters(
        uint256 newMaxPositionBps,
        uint256 newLiquidationThresholdBps,
        uint256 newRebalanceThresholdBps
    ) internal {
        require(newMaxPositionBps <= 10_000, "RiskController: max position out of range");
        require(
            newLiquidationThresholdBps <= 10_000,
            "RiskController: liquidation threshold out of range"
        );
        require(
            newRebalanceThresholdBps <= 10_000,
            "RiskController: rebalance threshold out of range"
        );

        parameters = RiskParameters({
            maxPositionBps: newMaxPositionBps,
            liquidationThresholdBps: newLiquidationThresholdBps,
            rebalanceThresholdBps: newRebalanceThresholdBps
        });
    }
}
