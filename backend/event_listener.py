from __future__ import annotations

import logging
import threading
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Optional

from web3 import Web3

from backend.blockchain import (
    GuardianContractClient,
    RetryConfig,
    RiskControllerClient,
    load_contract_abi,
    retry_call,
)
from backend.config import Settings, settings
from backend.pipeline import DefenseOrchestrator


logger = logging.getLogger("aegis.monitor")

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
]


def configure_logging(log_level: str) -> None:
    root_logger = logging.getLogger()
    if not root_logger.handlers:
        logging.basicConfig(
            level=log_level,
            format="%(asctime)s | %(levelname)s | %(message)s",
        )
    else:
        root_logger.setLevel(log_level)


class DeFiEventMonitor:
    def __init__(self, app_settings: Settings) -> None:
        self.settings = app_settings
        self.retry_config = RetryConfig(
            attempts=max(self.settings.rpc_retry_attempts, 1),
            base_delay_seconds=max(self.settings.rpc_retry_delay_seconds, 0.5),
            receipt_timeout_seconds=max(self.settings.receipt_timeout_seconds, 30),
            receipt_poll_latency_seconds=max(self.settings.receipt_poll_latency_seconds, 0.5),
        )
        self.w3 = Web3(Web3.HTTPProvider(self.settings.web3_provider_uri))

        if not retry_call(self.w3.is_connected, "connect to provider", self.retry_config):
            raise RuntimeError(f"Unable to connect to provider: {self.settings.web3_provider_uri}")
        if not self.settings.monitor_contract_address:
            raise RuntimeError("MONITOR_CONTRACT_ADDRESS is required")

        self.monitor_contract = self.w3.eth.contract(
            address=self.w3.to_checksum_address(self.settings.monitor_contract_address),
            abi=load_contract_abi(self.settings.monitor_contract_name, MONITOR_FALLBACK_ABI),
        )
        self.monitor_event = getattr(self.monitor_contract.events, self.settings.monitor_event_name)()
        self.event_abi = self._resolve_event_abi(self.settings.monitor_event_name)
        self.event_topic = self._build_event_topic(self.event_abi)

        self.guardian_client = GuardianContractClient(
            provider_uri=self.settings.web3_provider_uri,
            contract_address=self.settings.contract_address,
            signer_key=self.settings.guardian_signer_key,
            retry_config=self.retry_config,
            w3=self.w3,
        )
        self.risk_controller = RiskControllerClient(
            provider_uri=self.settings.web3_provider_uri,
            contract_address=self.settings.risk_controller_address,
            signer_key=self.settings.monitor_signer_key,
            retry_config=self.retry_config,
            w3=self.w3,
        )
        self.orchestrator = DefenseOrchestrator(
            guardian_client=self.guardian_client,
            risk_controller=self.risk_controller,
            hedge_max_position_bps=self.settings.hedge_max_position_bps,
            hedge_liquidation_threshold_bps=self.settings.hedge_liquidation_threshold_bps,
            hedge_rebalance_threshold_bps=self.settings.hedge_rebalance_threshold_bps,
        )

        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._next_block = self.settings.monitor_start_block
        self._processed_events = 0
        self._last_error: Optional[str] = None
        self._recent_events: deque[Dict[str, Any]] = deque(maxlen=self.settings.demo_log_limit)

    def start(self) -> None:
        if self.is_running():
            return

        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self.run_forever,
            name="aegis-event-monitor",
            daemon=True,
        )
        self._thread.start()
        logger.info(
            "[monitor] background listener started event=%s contract=%s",
            self.settings.monitor_event_name,
            self.monitor_contract.address,
        )

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=2)

    def is_running(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "running": self.is_running(),
                "web3_connected": self.w3.is_connected(),
                "monitor_contract_address": self.monitor_contract.address,
                "guardian_ready": self.guardian_client.is_ready(),
                "risk_controller_ready": self.risk_controller.is_ready(),
                "next_block": self._next_block,
                "processed_events": self._processed_events,
                "last_error": self._last_error,
                "recent_events": list(self._recent_events),
            }

    def run_forever(self) -> None:
        if self._next_block is None:
            self._next_block = retry_call(
                lambda: self.w3.eth.block_number,
                "read latest block number",
                self.retry_config,
            )

        logger.info(
            "[monitor] listening event=%s contract=%s from_block=%s",
            self.settings.monitor_event_name,
            self.monitor_contract.address,
            self._next_block,
        )

        while not self._stop_event.is_set():
            try:
                self.poll_once()
            except Exception as error:  # noqa: BLE001
                self._remember_error(str(error))
                logger.exception("[monitor] loop failure: %s", error)

            self._stop_event.wait(self.settings.monitor_poll_interval_seconds)

    def poll_once(self) -> int:
        if self._next_block is None:
            self._next_block = retry_call(
                lambda: self.w3.eth.block_number,
                "read latest block number",
                self.retry_config,
            )

        latest_block = retry_call(
            lambda: self.w3.eth.block_number,
            "poll latest block number",
            self.retry_config,
        )
        if self._next_block > latest_block:
            return 0

        logs = retry_call(
            lambda: self.w3.eth.get_logs(
                {
                    "fromBlock": self._next_block,
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

        with self._lock:
            self._next_block = latest_block + 1

        return len(logs)

    def _handle_event(self, event: Any) -> None:
        args = dict(event["args"])
        tx_hash = event["transactionHash"].hex()
        tx = retry_call(
            lambda: self.w3.eth.get_transaction(event["transactionHash"]),
            "fetch transaction details",
            self.retry_config,
        )
        block = retry_call(
            lambda: self.w3.eth.get_block(event["blockNumber"]),
            "fetch block details",
            self.retry_config,
        )

        transaction_data = self._build_transaction_data(args, tx, block)
        liquidity_changes = self._build_liquidity_changes(args)
        on_chain_data = self._build_on_chain_data(args, transaction_data, liquidity_changes)
        subject_address = self._resolve_subject_address(args)

        logger.info(
            "[event] tx=%s pair=%s reserve_change_bps=(%s,%s)",
            tx_hash,
            args.get("pair"),
            args.get("reserve0ChangeBps", 0),
            args.get("reserve1ChangeBps", 0),
        )

        result = self.orchestrator.evaluate_and_execute(
            subject_address=subject_address,
            transaction_data=transaction_data,
            liquidity_changes=liquidity_changes,
            on_chain_data=on_chain_data,
            summary_context=f"event={self.settings.monitor_event_name} tx={tx_hash}",
            record_guardian=True,
            execute_onchain=True,
        )

        anomaly = result["anomaly"]
        decision = result["decision"]
        executions = result["executions"]

        logger.info(
            "[ai] anomaly_score=%.4f decision=%s confidence=%.4f",
            anomaly["risk_score"],
            decision["action"],
            decision["confidence"],
        )
        logger.info("[action] executions=%s", executions or "none")

        event_record = {
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "block_number": int(event["blockNumber"]),
            "transaction_hash": tx_hash,
            "subject_address": subject_address,
            "event_args": self._stringify_mapping(args),
            "transaction_data": self._stringify_mapping(transaction_data),
            "liquidity_changes": self._stringify_mapping(liquidity_changes),
            "on_chain_data": self._stringify_mapping(on_chain_data),
            "anomaly": anomaly,
            "decision": decision,
            "executions": executions,
        }

        with self._lock:
            self._processed_events += 1
            self._last_error = None
            self._recent_events.appendleft(event_record)

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

    @staticmethod
    def _build_liquidity_changes(event_args: Mapping[str, Any]) -> Dict[str, Any]:
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

    def _remember_error(self, error_message: str) -> None:
        with self._lock:
            self._last_error = error_message

    @staticmethod
    def _stringify_mapping(values: Mapping[str, Any]) -> Dict[str, Any]:
        return {key: DeFiEventMonitor._stringify_value(value) for key, value in values.items()}

    @staticmethod
    def _stringify_value(value: Any) -> Any:
        if isinstance(value, (str, int, float, bool)) or value is None:
            return value
        if isinstance(value, bytes):
            return value.hex()
        if hasattr(value, "hex"):
            return value.hex()
        return str(value)


def main() -> None:
    configure_logging(settings.monitor_log_level)
    monitor = DeFiEventMonitor(settings)
    monitor.run_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("[monitor] stopped by user")
