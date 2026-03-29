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

REACTIVE_GUARDIAN_FALLBACK_ABI = [
    {
        "inputs": [],
        "name": "pair",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "sourceChainId",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "thresholdBps",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "baselineInitialized",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "lastObservedReserves",
        "outputs": [
            {"internalType": "uint112", "name": "reserve0", "type": "uint112"},
            {"internalType": "uint112", "name": "reserve1", "type": "uint112"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {
                "components": [
                    {"internalType": "uint256", "name": "chain_id", "type": "uint256"},
                    {"internalType": "address", "name": "_contract", "type": "address"},
                    {"internalType": "uint256", "name": "topic_0", "type": "uint256"},
                    {"internalType": "uint256", "name": "topic_1", "type": "uint256"},
                    {"internalType": "uint256", "name": "topic_2", "type": "uint256"},
                    {"internalType": "uint256", "name": "topic_3", "type": "uint256"},
                    {"internalType": "bytes", "name": "data", "type": "bytes"},
                    {"internalType": "uint256", "name": "block_number", "type": "uint256"},
                    {"internalType": "uint256", "name": "op_code", "type": "uint256"},
                    {"internalType": "uint256", "name": "block_hash", "type": "uint256"},
                    {"internalType": "uint256", "name": "tx_hash", "type": "uint256"},
                    {"internalType": "uint256", "name": "log_index", "type": "uint256"},
                ],
                "internalType": "struct IReactive.LogRecord",
                "name": "log",
                "type": "tuple",
            }
        ],
        "name": "react",
        "outputs": [],
        "stateMutability": "nonpayable",
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
    if not artifacts_root.exists():
        logger.warning(
            "Artifacts directory not found at %s, using fallback ABI for %s",
            artifacts_root,
            contract_name,
        )
        return fallback_abi

    artifact_matches = list(artifacts_root.rglob(f"{contract_name}.json"))
    if not artifact_matches:
        logger.warning("ABI artifact for %s not found, using fallback ABI", contract_name)
        return fallback_abi

    artifact_path = artifact_matches[0]
    try:
        with artifact_path.open("r", encoding="utf-8") as artifact_file:
            artifact = json.load(artifact_file)
        abi = artifact.get("abi")
        if not isinstance(abi, list):
            raise ValueError(f"ABI entry missing or invalid in {artifact_path}")
        logger.info("Loaded ABI for %s from %s", contract_name, artifact_path)
        return abi
    except Exception as error:  # noqa: BLE001
        logger.exception(
            "Unable to load ABI for %s from %s, using fallback ABI: %s",
            contract_name,
            artifact_path,
            error,
        )
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


def _safe_chain_id(w3: Web3) -> int | None:
    try:
        return int(w3.eth.chain_id)
    except Exception:  # noqa: BLE001
        return None


def connect_rpc(
    provider_uri: str,
    retry_config: Optional[RetryConfig] = None,
    *,
    strict: bool = False,
) -> Web3:
    if not provider_uri:
        raise ValueError("provider_uri is required to connect RPC")

    active_retry_config = retry_config or RetryConfig()
    logger.info("Connecting to RPC provider %s", provider_uri)
    w3 = Web3(Web3.HTTPProvider(provider_uri))

    try:
        connected = retry_call(
            w3.is_connected,
            "connect to RPC provider",
            active_retry_config,
        )
    except Exception as error:  # noqa: BLE001
        logger.exception("RPC connectivity check failed for %s: %s", provider_uri, error)
        if strict:
            raise RuntimeError(f"Unable to connect to RPC provider: {provider_uri}") from error
        return w3

    if connected:
        logger.info(
            "Connected to RPC provider %s chain_id=%s",
            provider_uri,
            _safe_chain_id(w3),
        )
    else:
        logger.error("RPC provider is unreachable: %s", provider_uri)
        if strict:
            raise RuntimeError(f"RPC provider is unreachable: {provider_uri}")

    return w3


def _build_contract(
    w3: Web3,
    contract_name: str,
    contract_address: str,
    fallback_abi: list[dict],
) -> Any:
    if not contract_address:
        logger.warning("No contract address configured for %s", contract_name)
        return None

    try:
        contract = w3.eth.contract(
            address=w3.to_checksum_address(contract_address),
            abi=load_contract_abi(contract_name, fallback_abi),
        )
    except Exception as error:  # noqa: BLE001
        logger.exception(
            "Unable to build contract client for %s at %s: %s",
            contract_name,
            contract_address,
            error,
        )
        raise RuntimeError(
            f"Unable to build contract client for {contract_name}: {contract_address}"
        ) from error

    logger.info("Loaded contract %s at %s", contract_name, contract.address)
    return contract


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
        self.retry_config = retry_config or RetryConfig()
        self.w3 = w3 or connect_rpc(provider_uri, self.retry_config)
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
        self.retry_config = retry_config or RetryConfig()
        self.w3 = w3 or connect_rpc(provider_uri, self.retry_config)
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

    def pauseProtocol(self) -> Optional[str]:
        logger.info(
            "pauseProtocol requested contract=%s connected=%s ready=%s",
            getattr(self.contract, "address", None),
            self.w3.is_connected(),
            self.is_ready(),
        )

        if not self.contract:
            logger.error("pauseProtocol failed: risk controller contract is not configured")
            raise RuntimeError("Risk controller contract is not configured")
        if not self.executor:
            logger.error("pauseProtocol failed: signer is not configured")
            raise RuntimeError("Risk controller signer is not configured")

        try:
            if self.paused():
                logger.info("pauseProtocol skipped: protocol is already paused")
                return None

            tx_hash = self.pause_protocol()
            logger.info("pauseProtocol submitted tx=%s", tx_hash)
            return tx_hash
        except Exception as error:  # noqa: BLE001
            logger.exception("pauseProtocol failed: %s", error)
            raise RuntimeError(f"pauseProtocol failed: {error}") from error

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

    def getStatus(self) -> Dict[str, Any]:
        status: Dict[str, Any] = {
            "web3_connected": self.w3.is_connected(),
            "ready": self.is_ready(),
            "contract_address": getattr(self.contract, "address", None),
            "chain_id": _safe_chain_id(self.w3),
            "paused": False,
            "parameters": None,
        }

        if not self.contract:
            status["error"] = "Risk controller contract is not configured"
            logger.warning("getStatus returning degraded state: %s", status["error"])
            return status

        try:
            status["paused"] = self.paused()
            status["parameters"] = self.parameters()
            logger.info(
                "getStatus succeeded contract=%s paused=%s",
                status["contract_address"],
                status["paused"],
            )
        except Exception as error:  # noqa: BLE001
            status["error"] = str(error)
            logger.exception("getStatus failed: %s", error)

        return status


class ReactiveLiquidityGuardianClient:
    UNISWAP_V2_SYNC_TOPIC_0 = int(
        "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1",
        16,
    )

    def __init__(
        self,
        provider_uri: str,
        contract_address: str,
        signer_key: str = "",
        retry_config: Optional[RetryConfig] = None,
        w3: Optional[Web3] = None,
    ) -> None:
        self.retry_config = retry_config or RetryConfig()
        self.w3 = w3 or connect_rpc(provider_uri, self.retry_config)
        self.contract = _build_contract(
            self.w3,
            "AegisReactiveLiquidityGuardian",
            contract_address,
            REACTIVE_GUARDIAN_FALLBACK_ABI,
        )
        self.executor = (
            TransactionExecutor(self.w3, signer_key, self.retry_config) if signer_key else None
        )

    def is_ready(self) -> bool:
        return bool(self.contract) and self.executor is not None and self.w3.is_connected()

    def pair_address(self) -> str:
        if not self.contract:
            return ""

        return retry_call(
            lambda: str(self.contract.functions.pair().call()),
            "read reactive guardian pair",
            self.retry_config,
        )

    def source_chain_id(self) -> int:
        if not self.contract:
            return 0

        return int(
            retry_call(
                lambda: self.contract.functions.sourceChainId().call(),
                "read reactive guardian sourceChainId",
                self.retry_config,
            )
        )

    def status(self) -> Optional[Dict[str, Any]]:
        if not self.contract:
            return None

        reserves = retry_call(
            lambda: self.contract.functions.lastObservedReserves().call(),
            "read reactive guardian reserves",
            self.retry_config,
        )
        return {
            "pair_address": self.pair_address(),
            "source_chain_id": self.source_chain_id(),
            "threshold_bps": int(
                retry_call(
                    lambda: self.contract.functions.thresholdBps().call(),
                    "read reactive guardian threshold",
                    self.retry_config,
                )
            ),
            "baseline_initialized": bool(
                retry_call(
                    lambda: self.contract.functions.baselineInitialized().call(),
                    "read reactive guardian baseline state",
                    self.retry_config,
                )
            ),
            "last_observed_reserves": {
                "reserve0": int(reserves[0]),
                "reserve1": int(reserves[1]),
            },
        }

    def react(
        self,
        *,
        reserve0: int,
        reserve1: int,
        block_number: int,
        pair_address: str = "",
        source_chain_id: Optional[int] = None,
    ) -> str:
        if not self.contract or not self.executor:
            raise RuntimeError("Reactive guardian client is not configured")

        pair = self.w3.to_checksum_address(pair_address or self.pair_address())
        chain_id = int(source_chain_id if source_chain_id is not None else self.source_chain_id())
        encoded_reserves = self.w3.codec.encode(["uint112", "uint112"], [reserve0, reserve1])
        log_record = (
            chain_id,
            pair,
            self.UNISWAP_V2_SYNC_TOPIC_0,
            0,
            0,
            0,
            encoded_reserves,
            int(block_number),
            0,
            0,
            0,
            0,
        )

        return self.executor.send_transaction(
            self.contract.functions.react(log_record),
            gas_limit=500000,
            description="reactive guardian react",
        )


def pauseProtocol(
    provider_uri: str,
    contract_address: str,
    signer_key: str,
    retry_config: Optional[RetryConfig] = None,
) -> Optional[str]:
    client = RiskControllerClient(
        provider_uri=provider_uri,
        contract_address=contract_address,
        signer_key=signer_key,
        retry_config=retry_config,
    )
    return client.pauseProtocol()


def getStatus(
    provider_uri: str,
    contract_address: str,
    signer_key: str = "",
    retry_config: Optional[RetryConfig] = None,
) -> Dict[str, Any]:
    client = RiskControllerClient(
        provider_uri=provider_uri,
        contract_address=contract_address,
        signer_key=signer_key,
        retry_config=retry_config,
    )
    return client.getStatus()
