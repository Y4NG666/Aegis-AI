from __future__ import annotations

import json
import logging
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Mapping, Optional, TypeVar

from dotenv import load_dotenv
from eth_account import Account
from web3 import Web3


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ai.anomaly_detection import DeFiAnomalyDetector
from ai.strategy_engine import StrategyEngine


load_dotenv()

logging.basicConfig(
    level=os.getenv("MONITOR_LOG_LEVEL", "INFO"),
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("aegis-monitor")

T = TypeVar("T")

RETRYABLE_ERROR_MARKERS = (
    "timeout",
    "timed out",
    "temporarily unavailable",
    "connection aborted",
    "connection reset",
    "failed to establish a new connection",
    "429",
    "too many requests",
    "rate limit",
    "header not found",
    "replacement transaction underpriced",
    "nonce too low",
    "already known",
    "transaction underpriced",
)
NON_RETRYABLE_ERROR_MARKERS = (
    "execution reverted",
    "invalid opcode",
    "insufficient funds",
    "intrinsic gas too low",
    "caller is not authorized",
    "not the owner",
    "transfer failed",
    "out of gas",
)


MONITOR_FALLBACK_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "address", "name": "pair", "type": "address"},
            {"indexed": False, "internalType": "uint112", "name": "reserve0", "type": "uint112"},
            {"indexed": False, "internalType": "uint112", "name": "reserve1", "type": "uint112"},
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "reserve0ChangeBps",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "reserve1ChangeBps",
                "type": "uint256",
            },
            {"indexed": False, "internalType": "uint256", "name": "thresholdBps", "type": "uint256"},
        ],
        "name": "AbnormalLiquidityDetected",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "address", "name": "pair", "type": "address"},
            {"indexed": False, "internalType": "uint112", "name": "reserve0", "type": "uint112"},
            {"indexed": False, "internalType": "uint112", "name": "reserve1", "type": "uint112"},
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "reserve0ChangeBps",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "reserve1ChangeBps",
                "type": "uint256",
            },
            {"indexed": False, "internalType": "bool", "name": "abnormal", "type": "bool"},
        ],
        "name": "LiquidityChangeChecked",
        "type": "event",
    },
]

RISK_CONTROLLER_FALLBACK_ABI = [
    {
        "inputs": [],
        "name": "pauseProtocol",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "newMaxPositionBps", "type": "uint256"},
            {
                "internalType": "uint256",
                "name": "newLiquidationThresholdBps",
                "type": "uint256",
            },
            {
                "internalType": "uint256",
                "name": "newRebalanceThresholdBps",
                "type": "uint256",
            },
        ],
        "name": "adjustParameters",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "paused",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
]

GUARDIAN_FALLBACK_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "account", "type": "address"},
            {"internalType": "uint256", "name": "riskScore", "type": "uint256"},
            {"internalType": "string", "name": "summary", "type": "string"},
            {"internalType": "bool", "name": "active", "type": "bool"},
        ],
        "name": "updateGuardianState",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    }
]


@dataclass
class RetryConfig:
    attempts: int
    base_delay_seconds: float
    receipt_timeout_seconds: int
    receipt_poll_latency_seconds: float


@dataclass
class MonitorSettings:
    web3_provider_uri: str = os.getenv("WEB3_PROVIDER_URI", "http://127.0.0.1:8545")
    monitor_contract_address: str = os.getenv("MONITOR_CONTRACT_ADDRESS", "")
    monitor_contract_name: str = os.getenv("MONITOR_CONTRACT_NAME", "AegisReactiveLiquidityGuardian")
    monitor_event_name: str = os.getenv("MONITOR_EVENT_NAME", "AbnormalLiquidityDetected")
    risk_controller_address: str = os.getenv("RISK_CONTROLLER_ADDRESS", "")
    guardian_contract_address: str = os.getenv(
        "AEGIS_CONTRACT_ADDRESS",
        os.getenv("GUARDIAN_CONTRACT_ADDRESS", ""),
    )
    signer_key_file: str = os.getenv("MONITOR_SIGNER_KEY_FILE", "")
    signer_keystore_path: str = os.getenv("MONITOR_SIGNER_KEYSTORE_PATH", "")
    signer_keystore_password: str = os.getenv("MONITOR_SIGNER_KEYSTORE_PASSWORD", "")
    poll_interval_seconds: float = float(os.getenv("MONITOR_POLL_INTERVAL_SECONDS", "5"))
    start_block: Optional[int] = (
        int(os.getenv("MONITOR_START_BLOCK"))
        if os.getenv("MONITOR_START_BLOCK")
        else None
    )
    eth_usd_price: float = float(os.getenv("ETH_USD_PRICE", "3000"))
    mev_gas_ratio_threshold: float = float(os.getenv("MEV_GAS_RATIO_THRESHOLD", "2.5"))
    default_collateral_ratio: float = float(os.getenv("DEFAULT_COLLATERAL_RATIO", "1.5"))
    hedge_max_position_bps: int = int(os.getenv("HEDGE_MAX_POSITION_BPS", "2500"))
    hedge_liquidation_threshold_bps: int = int(
        os.getenv("HEDGE_LIQUIDATION_THRESHOLD_BPS", "8000")
    )
    hedge_rebalance_threshold_bps: int = int(os.getenv("HEDGE_REBALANCE_THRESHOLD_BPS", "500"))
    rpc_retry_attempts: int = int(os.getenv("MONITOR_RPC_RETRY_ATTEMPTS", "3"))
    rpc_retry_delay_seconds: float = float(os.getenv("MONITOR_RPC_RETRY_DELAY_SECONDS", "2"))
    receipt_timeout_seconds: int = int(os.getenv("MONITOR_TX_RECEIPT_TIMEOUT_SECONDS", "120"))
    receipt_poll_latency_seconds: float = float(
        os.getenv("MONITOR_TX_RECEIPT_POLL_LATENCY_SECONDS", "2")
    )

    def retry_config(self) -> RetryConfig:
        return RetryConfig(
            attempts=max(self.rpc_retry_attempts, 1),
            base_delay_seconds=max(self.rpc_retry_delay_seconds, 0.5),
            receipt_timeout_seconds=max(self.receipt_timeout_seconds, 30),
            receipt_poll_latency_seconds=max(self.receipt_poll_latency_seconds, 0.5),
        )


def _load_contract_abi(contract_name: str, fallback_abi: list[dict]) -> list[dict]:
    artifacts_root = PROJECT_ROOT / "artifacts" / "contracts"
    if artifacts_root.exists():
        artifact_matches = list(artifacts_root.rglob(f"{contract_name}.json"))
        if artifact_matches:
            artifact_path = artifact_matches[0]
            with artifact_path.open("r", encoding="utf-8") as artifact_file:
                return json.load(artifact_file)["abi"]
    return fallback_abi


def _is_retryable_error(error: Exception) -> bool:
    message = str(error).lower()
    if any(marker in message for marker in NON_RETRYABLE_ERROR_MARKERS):
        return False
    if isinstance(error, (ConnectionError, TimeoutError, OSError)):
        return True
    return any(marker in message for marker in RETRYABLE_ERROR_MARKERS)


def _retry_call(
    operation: Callable[[], T],
    description: str,
    retry_config: RetryConfig,
) -> T:
    last_error: Optional[Exception] = None

    for attempt in range(1, retry_config.attempts + 1):
        try:
            return operation()
        except Exception as error:  # noqa: BLE001
            last_error = error
            should_retry = attempt < retry_config.attempts and _is_retryable_error(error)
            if not should_retry:
                raise

            delay_seconds = retry_config.base_delay_seconds * attempt
            logger.warning(
                "%s failed on attempt %s/%s: %s. Retrying in %.1fs",
                description,
                attempt,
                retry_config.attempts,
                error,
                delay_seconds,
            )
            time.sleep(delay_seconds)

    assert last_error is not None
    raise last_error


class SecureKeyLoader:
    @staticmethod
    def load(settings: MonitorSettings) -> str:
        if settings.signer_keystore_path:
            return SecureKeyLoader._load_from_keystore(
                settings.signer_keystore_path,
                settings.signer_keystore_password,
            )

        if settings.signer_key_file:
            return SecureKeyLoader._load_from_file(settings.signer_key_file)

        raw_key = os.getenv("MONITOR_SIGNER_KEY", os.getenv("GUARDIAN_SIGNER_KEY", "")).strip()
        if raw_key:
            SecureKeyLoader._validate_private_key(raw_key)
            return raw_key

        raise RuntimeError(
            "No signer configured. Set MONITOR_SIGNER_KEYSTORE_PATH, MONITOR_SIGNER_KEY_FILE, "
            "or MONITOR_SIGNER_KEY."
        )

    @staticmethod
    def _load_from_keystore(keystore_path: str, password: str) -> str:
        if not password:
            raise RuntimeError("MONITOR_SIGNER_KEYSTORE_PASSWORD is required for keystore usage")

        resolved_path = SecureKeyLoader._resolve_path(keystore_path)
        with resolved_path.open("r", encoding="utf-8") as keystore_file:
            keystore = json.load(keystore_file)

        private_key_bytes = Account.decrypt(keystore, password)
        private_key = Web3.to_hex(private_key_bytes)
        SecureKeyLoader._validate_private_key(private_key)
        return private_key

    @staticmethod
    def _load_from_file(key_file_path: str) -> str:
        resolved_path = SecureKeyLoader._resolve_path(key_file_path)
        private_key = resolved_path.read_text(encoding="utf-8").strip()
        SecureKeyLoader._validate_private_key(private_key)
        return private_key

    @staticmethod
    def _resolve_path(raw_path: str) -> Path:
        path = Path(raw_path)
        return path if path.is_absolute() else PROJECT_ROOT / path

    @staticmethod
    def _validate_private_key(private_key: str) -> None:
        Account.from_key(private_key)


class TransactionExecutor:
    def __init__(self, w3: Web3, private_key: str, retry_config: RetryConfig) -> None:
        self.w3 = w3
        self.account = Account.from_key(private_key)
        self.retry_config = retry_config

    def send_transaction(
        self,
        contract_function: Any,
        gas_limit: int,
        description: str,
    ) -> str:
        tx_hash = _retry_call(
            lambda: self._build_sign_and_send(contract_function, gas_limit),
            f"send {description}",
            self.retry_config,
        )
        self._wait_for_receipt(tx_hash, description)
        return tx_hash

    def _build_sign_and_send(self, contract_function: Any, gas_limit: int) -> str:
        nonce = self.w3.eth.get_transaction_count(self.account.address, "pending")
        tx_params: Dict[str, Any] = {
            "from": self.account.address,
            "nonce": nonce,
            "gas": gas_limit,
            "chainId": self.w3.eth.chain_id,
        }

        latest_block = self.w3.eth.get_block("latest")
        if latest_block.get("baseFeePerGas") is not None:
            priority_fee = self._priority_fee()
            base_fee = int(latest_block["baseFeePerGas"])
            tx_params["maxPriorityFeePerGas"] = priority_fee
            tx_params["maxFeePerGas"] = max(base_fee * 2 + priority_fee, self.w3.eth.gas_price)
        else:
            tx_params["gasPrice"] = self.w3.eth.gas_price

        transaction = contract_function.build_transaction(tx_params)
        signed_tx = self.account.sign_transaction(transaction)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        return tx_hash.hex()

    def _wait_for_receipt(self, tx_hash: str, description: str) -> None:
        _retry_call(
            lambda: self.w3.eth.wait_for_transaction_receipt(
                tx_hash,
                timeout=self.retry_config.receipt_timeout_seconds,
                poll_latency=self.retry_config.receipt_poll_latency_seconds,
            ),
            f"wait for {description} receipt",
            self.retry_config,
        )

    def _priority_fee(self) -> int:
        try:
            return int(self.w3.eth.max_priority_fee)
        except Exception:  # noqa: BLE001
            return self.w3.to_wei(2, "gwei")


class GuardianRecorderClient:
    def __init__(
        self,
        w3: Web3,
        contract_address: str,
        executor: Optional[TransactionExecutor],
    ) -> None:
        self.w3 = w3
        self.executor = executor
        self.contract = None

        if contract_address:
            self.contract = self.w3.eth.contract(
                address=self.w3.to_checksum_address(contract_address),
                abi=_load_contract_abi("AegisAIGuardian", GUARDIAN_FALLBACK_ABI),
            )

    def is_ready(self) -> bool:
        return bool(self.contract) and self.executor is not None and self.w3.is_connected()

    def record_assessment(
        self,
        wallet_address: str,
        risk_score: int,
        summary: str,
        active_guardian: bool,
    ) -> str:
        if not self.contract or not self.executor:
            raise RuntimeError("Guardian recorder is not configured")

        return self.executor.send_transaction(
            self.contract.functions.updateGuardianState(
                self.w3.to_checksum_address(wallet_address),
                risk_score,
                summary,
                active_guardian,
            ),
            gas_limit=300000,
            description="guardian assessment update",
        )


class RiskControllerClient:
    def __init__(
        self,
        w3: Web3,
        contract_address: str,
        executor: Optional[TransactionExecutor],
        retry_config: RetryConfig,
    ) -> None:
        self.w3 = w3
        self.executor = executor
        self.retry_config = retry_config
        self.contract = None

        if contract_address:
            self.contract = self.w3.eth.contract(
                address=self.w3.to_checksum_address(contract_address),
                abi=_load_contract_abi("RiskController", RISK_CONTROLLER_FALLBACK_ABI),
            )

    def is_ready(self) -> bool:
        return bool(self.contract) and self.executor is not None and self.w3.is_connected()

    def paused(self) -> bool:
        if not self.contract:
            return False
        return _retry_call(
            lambda: bool(self.contract.functions.paused().call()),
            "read risk controller paused state",
            self.retry_config,
        )

    def pause_protocol(self) -> Optional[str]:
        if not self.contract or not self.executor:
            return None
        return self.executor.send_transaction(
            self.contract.functions.pauseProtocol(),
            gas_limit=250000,
            description="risk controller pauseProtocol",
        )

    def adjust_parameters(
        self,
        max_position_bps: int,
        liquidation_threshold_bps: int,
        rebalance_threshold_bps: int,
    ) -> Optional[str]:
        if not self.contract or not self.executor:
            return None
        return self.executor.send_transaction(
            self.contract.functions.adjustParameters(
                max_position_bps,
                liquidation_threshold_bps,
                rebalance_threshold_bps,
            ),
            gas_limit=300000,
            description="risk controller adjustParameters",
        )


class DeFiEventMonitor:
    def __init__(self, settings: MonitorSettings) -> None:
        self.settings = settings
        self.retry_config = settings.retry_config()
        self.w3 = Web3(Web3.HTTPProvider(settings.web3_provider_uri))

        if not _retry_call(self.w3.is_connected, "connect to provider", self.retry_config):
            raise RuntimeError(f"Unable to connect to provider: {settings.web3_provider_uri}")

        if not settings.monitor_contract_address:
            raise RuntimeError("MONITOR_CONTRACT_ADDRESS is required")

        self.monitor_contract = self.w3.eth.contract(
            address=self.w3.to_checksum_address(settings.monitor_contract_address),
            abi=_load_contract_abi(settings.monitor_contract_name, MONITOR_FALLBACK_ABI),
        )
        self.monitor_event = getattr(self.monitor_contract.events, settings.monitor_event_name)()
        self.event_abi = self._resolve_event_abi(settings.monitor_event_name)
        self.event_topic = self._build_event_topic(self.event_abi)

        self.anomaly_detector = DeFiAnomalyDetector()
        self.strategy_engine = StrategyEngine()

        executor: Optional[TransactionExecutor] = None
        if settings.guardian_contract_address or settings.risk_controller_address:
            private_key = SecureKeyLoader.load(settings)
            executor = TransactionExecutor(self.w3, private_key, self.retry_config)

        self.guardian_client = GuardianRecorderClient(
            w3=self.w3,
            contract_address=settings.guardian_contract_address,
            executor=executor,
        )
        self.risk_controller = RiskControllerClient(
            w3=self.w3,
            contract_address=settings.risk_controller_address,
            executor=executor,
            retry_config=self.retry_config,
        )

    def run(self) -> None:
        next_block = self.settings.start_block
        if next_block is None:
            next_block = _retry_call(
                lambda: self.w3.eth.block_number,
                "read latest block number",
                self.retry_config,
            )

        logger.info(
            "Monitoring %s on contract %s from block %s",
            self.settings.monitor_event_name,
            self.monitor_contract.address,
            next_block,
        )

        while True:
            try:
                latest_block = _retry_call(
                    lambda: self.w3.eth.block_number,
                    "poll latest block number",
                    self.retry_config,
                )
                if next_block <= latest_block:
                    logs = _retry_call(
                        lambda: self.w3.eth.get_logs(
                            {
                                "fromBlock": next_block,
                                "toBlock": latest_block,
                                "address": self.monitor_contract.address,
                                "topics": [self.event_topic],
                            }
                        ),
                        "fetch monitor logs",
                        self.retry_config,
                    )

                    for raw_log in logs:
                        decoded_event = self.monitor_event.process_log(raw_log)
                        self._handle_event(decoded_event)

                    next_block = latest_block + 1
            except Exception as error:  # noqa: BLE001
                logger.exception("Monitor loop failed: %s", error)

            time.sleep(self.settings.poll_interval_seconds)

    def _handle_event(self, event: Any) -> None:
        args = dict(event["args"])
        tx = _retry_call(
            lambda: self.w3.eth.get_transaction(event["transactionHash"]),
            "fetch transaction details",
            self.retry_config,
        )
        block = _retry_call(
            lambda: self.w3.eth.get_block(event["blockNumber"]),
            "fetch block details",
            self.retry_config,
        )

        transaction_data = self._build_transaction_data(args, tx, block)
        liquidity_changes = self._build_liquidity_changes(args)

        anomaly = self.anomaly_detector.assess(transaction_data, liquidity_changes)
        on_chain_data = self._build_on_chain_data(args, transaction_data, liquidity_changes)
        decision = self.strategy_engine.decide(anomaly.risk_score, on_chain_data)
        tx_results = self._execute_decision(decision.action, args, anomaly.risk_score)

        logger.info(
            "Processed event=%s tx=%s risk_score=%.4f decision=%s tx_actions=%s",
            self.settings.monitor_event_name,
            event["transactionHash"].hex(),
            anomaly.risk_score,
            decision.action,
            tx_results or "none",
        )
        logger.info("Reasons: %s", "; ".join(decision.reasons))

    def _build_transaction_data(
        self,
        event_args: Mapping[str, Any],
        tx: Mapping[str, Any],
        block: Mapping[str, Any],
    ) -> Dict[str, Any]:
        tx_value_eth = float(self.w3.from_wei(int(tx.get("value", 0)), "ether"))
        tx_value_usd = tx_value_eth * self.settings.eth_usd_price

        gas_price = int(tx.get("gasPrice", 0) or 0)
        base_fee = int(block.get("baseFeePerGas", gas_price or 1) or 1)
        gas_spike_ratio = gas_price / base_fee if base_fee else 1.0

        reserve_change_bps = max(
            float(event_args.get("reserve0ChangeBps", 0)),
            float(event_args.get("reserve1ChangeBps", 0)),
        )
        threshold_bps = max(float(event_args.get("thresholdBps", 0)), 1.0)

        return {
            "tx_value_usd": tx_value_usd,
            "slippage_bps": reserve_change_bps,
            "gas_spike_ratio": gas_spike_ratio if gas_spike_ratio > 0 else 1.0,
            "failed_tx_count_1h": int(event_args.get("failedTxCount1h", 0)),
            "unique_protocols_1h": int(event_args.get("uniqueProtocols1h", 1)),
            "flash_loan_detected": bool(event_args.get("flashLoanDetected", False)),
            "mev_flagged": gas_spike_ratio >= self.settings.mev_gas_ratio_threshold
            or reserve_change_bps >= threshold_bps,
        }

    def _build_liquidity_changes(self, event_args: Mapping[str, Any]) -> Dict[str, Any]:
        reserve0_change_pct = float(event_args.get("reserve0ChangeBps", 0)) / 100.0
        reserve1_change_pct = float(event_args.get("reserve1ChangeBps", 0)) / 100.0
        reserve0 = float(event_args.get("reserve0", 0))
        reserve1 = float(event_args.get("reserve1", 0))
        max_change_pct = max(reserve0_change_pct, reserve1_change_pct)

        return {
            "liquidity_before_usd": max(reserve0 + reserve1, 0.0),
            "liquidity_after_usd": max((reserve0 + reserve1) * (1 - max_change_pct / 100.0), 0.0),
            "reserve0_change_pct": reserve0_change_pct,
            "reserve1_change_pct": reserve1_change_pct,
        }

    def _build_on_chain_data(
        self,
        event_args: Mapping[str, Any],
        transaction_data: Mapping[str, Any],
        liquidity_changes: Mapping[str, Any],
    ) -> Dict[str, Any]:
        liquidity_drop_pct = max(
            float(liquidity_changes.get("reserve0_change_pct", 0.0)),
            float(liquidity_changes.get("reserve1_change_pct", 0.0)),
        )
        threshold_bps = float(event_args.get("thresholdBps", 0))
        volatility_index = 0.0

        if threshold_bps > 0:
            volatility_index = min(
                max(
                    float(event_args.get("reserve0ChangeBps", 0)),
                    float(event_args.get("reserve1ChangeBps", 0)),
                )
                / threshold_bps,
                1.0,
            )

        return {
            "protocol_paused": self.risk_controller.paused() if self.risk_controller.contract else False,
            "liquidity_drop_pct": liquidity_drop_pct,
            "volatility_index": volatility_index,
            "collateral_ratio": self.settings.default_collateral_ratio,
            "pool_utilization": min(float(transaction_data.get("gas_spike_ratio", 1.0)) / 5.0, 1.0),
            "active_exploit_flag": bool(event_args.get("activeExploitFlag", False)),
        }

    def _execute_decision(
        self,
        action: str,
        event_args: Mapping[str, Any],
        anomaly_score: float,
    ) -> Dict[str, str]:
        results: Dict[str, str] = {}
        subject_address = self._resolve_subject_address(event_args)

        if self.guardian_client.is_ready():
            summary = (
                f"Monitor decision={action} risk_score={anomaly_score:.4f} "
                f"event={self.settings.monitor_event_name}"
            )
            results["guardian"] = self.guardian_client.record_assessment(
                wallet_address=subject_address,
                risk_score=int(round(anomaly_score * 100)),
                summary=summary,
                active_guardian=action in {"pause", "hedge"},
            )

        if not self.risk_controller.is_ready():
            return results

        if action == "pause" and not self.risk_controller.paused():
            pause_tx = self.risk_controller.pause_protocol()
            if pause_tx:
                results["pause"] = pause_tx
        elif action == "hedge":
            hedge_tx = self.risk_controller.adjust_parameters(
                self.settings.hedge_max_position_bps,
                self.settings.hedge_liquidation_threshold_bps,
                self.settings.hedge_rebalance_threshold_bps,
            )
            if hedge_tx:
                results["hedge"] = hedge_tx

        return results

    def _resolve_event_abi(self, event_name: str) -> dict:
        for item in self.monitor_contract.abi:
            if item.get("type") == "event" and item.get("name") == event_name:
                return item
        raise ValueError(f"Event ABI not found for {event_name}")

    @staticmethod
    def _build_event_topic(event_abi: Mapping[str, Any]) -> str:
        signature = "{}({})".format(
            event_abi["name"],
            ",".join(input_item["type"] for input_item in event_abi.get("inputs", [])),
        )
        return Web3.keccak(text=signature).hex()

    def _resolve_subject_address(self, event_args: Mapping[str, Any]) -> str:
        for key in ("account", "wallet", "pair"):
            value = event_args.get(key)
            if isinstance(value, str) and Web3.is_address(value):
                return self.w3.to_checksum_address(value)
        return self.monitor_contract.address


def main() -> None:
    settings = MonitorSettings()
    monitor = DeFiEventMonitor(settings)
    monitor.run()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Monitor stopped by user")
