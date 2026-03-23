// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPayer {
    function pay(uint256 amount) external;

    receive() external payable;
}

interface ISubscriptionService {
    function subscribe(
        uint256 chainId,
        address targetContract,
        uint256 topic0,
        uint256 topic1,
        uint256 topic2,
        uint256 topic3
    ) external;

    function unsubscribe(
        uint256 chainId,
        address targetContract,
        uint256 topic0,
        uint256 topic1,
        uint256 topic2,
        uint256 topic3
    ) external;
}

interface ISystemContract is ISubscriptionService {}

interface IReactive is IPayer {
    struct LogRecord {
        uint256 chain_id;
        address _contract;
        uint256 topic_0;
        uint256 topic_1;
        uint256 topic_2;
        uint256 topic_3;
        bytes data;
        uint256 block_number;
        uint256 op_code;
        uint256 block_hash;
        uint256 tx_hash;
        uint256 log_index;
    }

    event Callback(
        uint256 indexed chain_id,
        address indexed _contract,
        uint64 indexed gas_limit,
        bytes payload
    );

    function react(LogRecord calldata log) external;
}

abstract contract ReactiveBase is IReactive {
    uint256 internal constant REACTIVE_IGNORE =
        0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad;
    address internal constant SERVICE_ADDRESS =
        0x0000000000000000000000000000000000fffFfF;

    mapping(address => bool) internal authorizedSenders;

    bool internal vm;
    ISystemContract internal service;

    modifier authorizedSenderOnly() {
        require(authorizedSenders[msg.sender], "Reactive: unauthorized sender");
        _;
    }

    modifier vmOnly() {
        require(vm, "Reactive: VM only");
        _;
    }

    modifier rnOnly() {
        require(!vm, "Reactive: RN only");
        _;
    }

    constructor() {
        service = ISystemContract(SERVICE_ADDRESS);
        authorizedSenders[SERVICE_ADDRESS] = true;
        _detectVm();
    }

    receive() external payable virtual {}

    function pay(uint256 amount) external override authorizedSenderOnly {
        require(address(this).balance >= amount, "Reactive: insufficient balance");

        if (amount > 0) {
            (bool success,) = payable(msg.sender).call{value: amount}("");
            require(success, "Reactive: transfer failed");
        }
    }

    function _detectVm() internal {
        uint256 size;
        assembly {
            size := extcodesize(0x0000000000000000000000000000000000fffFfF)
        }
        vm = size == 0;
    }
}

abstract contract CallbackBase is IPayer {
    mapping(address => bool) internal authorizedSenders;

    modifier authorizedSenderOnly() {
        require(authorizedSenders[msg.sender], "Callback: unauthorized sender");
        _;
    }

    constructor(address callbackSender) {
        require(callbackSender != address(0), "Callback: invalid sender");
        authorizedSenders[callbackSender] = true;
    }

    receive() external payable virtual {}

    function pay(uint256 amount) external override authorizedSenderOnly {
        require(address(this).balance >= amount, "Callback: insufficient balance");

        if (amount > 0) {
            (bool success,) = payable(msg.sender).call{value: amount}("");
            require(success, "Callback: transfer failed");
        }
    }
}

contract AegisReactiveLiquidityGuardian is ReactiveBase {
    uint256 public constant UNISWAP_V2_SYNC_TOPIC_0 =
        0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1;

    struct Reserves {
        uint112 reserve0;
        uint112 reserve1;
    }

    address public owner;
    uint256 public immutable sourceChainId;
    uint256 public immutable callbackChainId;
    address public immutable pair;

    address public callbackContract;
    uint64 public callbackGasLimit;
    uint256 public thresholdBps;
    bool public baselineInitialized;
    Reserves public lastObservedReserves;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SyncSubscriptionCreated(address indexed pair, uint256 indexed sourceChainId);
    event ThresholdUpdated(uint256 previousThresholdBps, uint256 newThresholdBps);
    event CallbackConfigUpdated(address indexed callbackContract, uint64 callbackGasLimit);
    event BaselineInitialized(uint112 reserve0, uint112 reserve1, uint256 blockNumber);
    event LiquidityChangeChecked(
        address indexed pair,
        uint112 reserve0,
        uint112 reserve1,
        uint256 reserve0ChangeBps,
        uint256 reserve1ChangeBps,
        bool abnormal
    );
    event AbnormalLiquidityDetected(
        address indexed pair,
        uint112 reserve0,
        uint112 reserve1,
        uint256 reserve0ChangeBps,
        uint256 reserve1ChangeBps,
        uint256 thresholdBps
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Guardian: caller is not the owner");
        _;
    }

    constructor(
        uint256 _sourceChainId,
        uint256 _callbackChainId,
        address _pair,
        address _callbackContract,
        uint256 _thresholdBps,
        uint64 _callbackGasLimit
    ) payable {
        require(_pair != address(0), "Guardian: invalid pair");
        require(_callbackContract != address(0), "Guardian: invalid callback");
        require(_thresholdBps > 0, "Guardian: invalid threshold");
        require(_callbackGasLimit > 0, "Guardian: invalid gas limit");

        owner = msg.sender;
        sourceChainId = _sourceChainId;
        callbackChainId = _callbackChainId;
        pair = _pair;
        callbackContract = _callbackContract;
        thresholdBps = _thresholdBps;
        callbackGasLimit = _callbackGasLimit;

        emit OwnershipTransferred(address(0), msg.sender);

        // On the top-level Reactive Network deployment, register a Sync subscription.
        if (!vm) {
            service.subscribe(
                sourceChainId,
                pair,
                UNISWAP_V2_SYNC_TOPIC_0,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE
            );
            emit SyncSubscriptionCreated(pair, sourceChainId);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Guardian: invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setThresholdBps(uint256 newThresholdBps) external onlyOwner {
        require(newThresholdBps > 0, "Guardian: invalid threshold");
        emit ThresholdUpdated(thresholdBps, newThresholdBps);
        thresholdBps = newThresholdBps;
    }

    function setCallbackConfig(address newCallbackContract, uint64 newCallbackGasLimit) external onlyOwner {
        require(newCallbackContract != address(0), "Guardian: invalid callback");
        require(newCallbackGasLimit > 0, "Guardian: invalid gas limit");

        callbackContract = newCallbackContract;
        callbackGasLimit = newCallbackGasLimit;

        emit CallbackConfigUpdated(newCallbackContract, newCallbackGasLimit);
    }

    function react(LogRecord calldata log) external override vmOnly {
        if (
            log.chain_id != sourceChainId ||
            log._contract != pair ||
            log.topic_0 != UNISWAP_V2_SYNC_TOPIC_0
        ) {
            return;
        }

        (uint112 reserve0, uint112 reserve1) = abi.decode(log.data, (uint112, uint112));
        Reserves memory currentReserves = Reserves({reserve0: reserve0, reserve1: reserve1});

        if (!baselineInitialized) {
            baselineInitialized = true;
            lastObservedReserves = currentReserves;
            emit BaselineInitialized(reserve0, reserve1, log.block_number);
            return;
        }

        uint256 reserve0ChangeBps = _absoluteChangeBps(
            lastObservedReserves.reserve0,
            currentReserves.reserve0
        );
        uint256 reserve1ChangeBps = _absoluteChangeBps(
            lastObservedReserves.reserve1,
            currentReserves.reserve1
        );
        bool abnormal = reserve0ChangeBps >= thresholdBps || reserve1ChangeBps >= thresholdBps;

        emit LiquidityChangeChecked(
            pair,
            currentReserves.reserve0,
            currentReserves.reserve1,
            reserve0ChangeBps,
            reserve1ChangeBps,
            abnormal
        );

        if (abnormal) {
            bytes memory payload = abi.encodeWithSignature(
                "handleLiquidityAlert(address,address,uint112,uint112,uint256,uint256,uint256)",
                address(0),
                pair,
                currentReserves.reserve0,
                currentReserves.reserve1,
                reserve0ChangeBps,
                reserve1ChangeBps,
                thresholdBps
            );

            emit AbnormalLiquidityDetected(
                pair,
                currentReserves.reserve0,
                currentReserves.reserve1,
                reserve0ChangeBps,
                reserve1ChangeBps,
                thresholdBps
            );

            emit Callback(callbackChainId, callbackContract, callbackGasLimit, payload);
        }

        lastObservedReserves = currentReserves;
    }

    function _absoluteChangeBps(uint112 previousValue, uint112 currentValue) internal pure returns (uint256) {
        if (previousValue == 0) {
            return currentValue == 0 ? 0 : type(uint256).max;
        }

        uint256 previous = uint256(previousValue);
        uint256 current = uint256(currentValue);
        uint256 difference = current >= previous ? current - previous : previous - current;
        return (difference * 10_000) / previous;
    }
}

contract AegisLiquidityAlertCallback is CallbackBase {
    struct LiquidityAlert {
        address pair;
        uint112 reserve0;
        uint112 reserve1;
        uint256 reserve0ChangeBps;
        uint256 reserve1ChangeBps;
        uint256 thresholdBps;
        uint256 handledAt;
    }

    LiquidityAlert public lastAlert;

    event LiquidityAlertHandled(
        address indexed pair,
        uint112 reserve0,
        uint112 reserve1,
        uint256 reserve0ChangeBps,
        uint256 reserve1ChangeBps,
        uint256 thresholdBps
    );

    constructor(address callbackSender) CallbackBase(callbackSender) payable {}

    function handleLiquidityAlert(
        address, /* rvmId */
        address pair,
        uint112 reserve0,
        uint112 reserve1,
        uint256 reserve0ChangeBps,
        uint256 reserve1ChangeBps,
        uint256 configuredThresholdBps
    ) external authorizedSenderOnly {
        lastAlert = LiquidityAlert({
            pair: pair,
            reserve0: reserve0,
            reserve1: reserve1,
            reserve0ChangeBps: reserve0ChangeBps,
            reserve1ChangeBps: reserve1ChangeBps,
            thresholdBps: configuredThresholdBps,
            handledAt: block.timestamp
        });

        emit LiquidityAlertHandled(
            pair,
            reserve0,
            reserve1,
            reserve0ChangeBps,
            reserve1ChangeBps,
            configuredThresholdBps
        );
    }
}
