from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Optional, TypeVar

from eth_account import Account
from web3 import Web3


PROJECT_ROOT = Path(__file__).resolve().parents[1]
logger = logging.getLogger("aegis.blockchain")
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

GUARDIAN_FALLBACK_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "getGuardianState",
        "outputs": [
            {
                "components": [
                    {"internalType": "bool", "name": "active", "type": "bool"},
                    {"internalType": "uint256", "name": "lastRiskScore", "type": "uint256"},
                    {"internalType": "uint256", "name": "lastUpdated", "type": "uint256"},
                    {"internalType": "string", "name": "latestSummary", "type": "string"},
                ],
                "internalType": "struct AegisAIGuardian.GuardianState",
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
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
    {
        "inputs": [],
        "name": "parameters",
        "outputs": [
            {"internalType": "uint256", "name": "maxPositionBps", "type": "uint256"},
            {
                "internalType": "uint256",
                "name": "liquidationThresholdBps",
                "type": "uint256",
            },
            {
                "internalType": "uint256",
                "name": "rebalanceThresholdBps",
                "type": "uint256",
            },
        ],
        "stateMutability": "view",
        "type": "function",
    },
]


@dataclass
class RetryConfig:
    attempts: int = 3
    base_delay_seconds: float = 2.0
    receipt_timeout_seconds: int = 120
    receipt_poll_latency_seconds: float = 2.0


def load_contract_abi(contract_name: str, fallback_abi: list[dict]) -> list[dict]:
    artifacts_root = PROJECT_ROOT / "artifacts" / "contracts"
    if artifacts_root.exists():
        artifact_matches = list(artifacts_root.rglob(f"{contract_name}.json"))
        if artifact_matches:
            with artifact_matches[0].open("r", encoding="utf-8") as artifact_file:
                return json.load(artifact_file)["abi"]
    return fallback_abi


def is_retryable_error(error: Exception) -> bool:
    message = str(error).lower()
    if any(marker in message for marker in NON_RETRYABLE_ERROR_MARKERS):
        return False
    if isinstance(error, (ConnectionError, TimeoutError, OSError)):
        return True
    return any(marker in message for marker in RETRYABLE_ERROR_MARKERS)


def retry_call(
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
            should_retry = attempt < retry_config.attempts and is_retryable_error(error)
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


def _build_contract(
    w3: Web3,
    contract_name: str,
    contract_address: str,
    fallback_abi: list[dict],
) -> Any:
    if not contract_address:
        return None

    return w3.eth.contract(
        address=w3.to_checksum_address(contract_address),
        abi=load_contract_abi(contract_name, fallback_abi),
    )


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
        tx_hash = retry_call(
            lambda: self._build_sign_and_send(contract_function, gas_limit),
            f"send {description}",
            self.retry_config,
        )
        receipt = self._wait_for_receipt(tx_hash, description)
        if int(receipt.get("status", 0)) != 1:
            raise RuntimeError(f"{description} transaction reverted: {tx_hash}")

        logger.info(
            "Confirmed %s tx=%s block=%s",
            description,
            tx_hash,
            receipt.get("blockNumber"),
        )
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

    def _wait_for_receipt(self, tx_hash: str, description: str) -> Any:
        return retry_call(
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


class GuardianContractClient:
    def __init__(
        self,
        provider_uri: str,
        contract_address: str,
        signer_key: str = "",
        retry_config: Optional[RetryConfig] = None,
        w3: Optional[Web3] = None,
    ) -> None:
        self.w3 = w3 or Web3(Web3.HTTPProvider(provider_uri))
        self.retry_config = retry_config or RetryConfig()
        self.contract = _build_contract(
            self.w3,
            "AegisAIGuardian",
            contract_address,
            GUARDIAN_FALLBACK_ABI,
        )
        self.executor = (
            TransactionExecutor(self.w3, signer_key, self.retry_config) if signer_key else None
        )

    def is_ready(self) -> bool:
        return bool(self.contract) and self.executor is not None and self.w3.is_connected()

    def get_guardian_state(self, wallet_address: str) -> Optional[Dict[str, Any]]:
        if not self.contract:
            return None

        state = retry_call(
            lambda: self.contract.functions.getGuardianState(
                self.w3.to_checksum_address(wallet_address)
            ).call(),
            "read guardian state",
            self.retry_config,
        )
        return {
            "active": state[0],
            "last_risk_score": int(state[1]),
            "last_updated": int(state[2]),
            "latest_summary": state[3],
        }

    def record_assessment(
        self,
        wallet_address: str,
        risk_score: int,
        summary: str,
        active_guardian: bool,
    ) -> str:
        if not self.contract or not self.executor:
            raise RuntimeError("Guardian contract client is not configured")

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
        provider_uri: str,
        contract_address: str,
        signer_key: str = "",
        retry_config: Optional[RetryConfig] = None,
        w3: Optional[Web3] = None,
    ) -> None:
        self.w3 = w3 or Web3(Web3.HTTPProvider(provider_uri))
        self.retry_config = retry_config or RetryConfig()
        self.contract = _build_contract(
            self.w3,
            "RiskController",
            contract_address,
            RISK_CONTROLLER_FALLBACK_ABI,
        )
        self.executor = (
            TransactionExecutor(self.w3, signer_key, self.retry_config) if signer_key else None
        )

    def is_ready(self) -> bool:
        return bool(self.contract) and self.executor is not None and self.w3.is_connected()

    def paused(self) -> bool:
        if not self.contract:
            return False

        return retry_call(
            lambda: bool(self.contract.functions.paused().call()),
            "read risk controller paused state",
            self.retry_config,
        )

    def parameters(self) -> Optional[Dict[str, int]]:
        if not self.contract:
            return None

        params = retry_call(
            lambda: self.contract.functions.parameters().call(),
            "read risk controller parameters",
            self.retry_config,
        )
        return {
            "max_position_bps": int(params[0]),
            "liquidation_threshold_bps": int(params[1]),
            "rebalance_threshold_bps": int(params[2]),
        }

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
