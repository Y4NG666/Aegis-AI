from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv


load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Public Hardhat dev key used only as a local demo fallback when no signer is configured.
HARDHAT_LOCAL_PRIVATE_KEY = (
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
)
PLACEHOLDER_MARKERS = ("YOUR_", "0xYour", "change-me")


def _clean_string(value: Optional[str], default: str = "") -> str:
    if value is None:
        return default

    candidate = value.strip()
    if not candidate:
        return default
    if any(marker in candidate for marker in PLACEHOLDER_MARKERS):
        return default
    return candidate


def _resolve_path(raw_path: Optional[str]) -> Optional[Path]:
    cleaned = _clean_string(raw_path)
    if not cleaned:
        return None

    path = Path(cleaned)
    return path if path.is_absolute() else PROJECT_ROOT / path


def _load_deployment_manifest() -> Dict[str, Any]:
    manifest_path = _resolve_path(os.getenv("AEGIS_DEPLOYMENT_FILE", "deployments/localhost.json"))
    if not manifest_path or not manifest_path.exists():
        return {}

    with manifest_path.open("r", encoding="utf-8") as deployment_file:
        return json.load(deployment_file)


def _bool_env(name: str, default: bool = False) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _optional_int_env(name: str) -> Optional[int]:
    raw_value = _clean_string(os.getenv(name))
    if not raw_value:
        return None
    return int(raw_value)


def _select_string(
    env_name: str,
    deployment_manifest: Dict[str, Any],
    deployment_key: str = "",
    default: str = "",
) -> str:
    env_value = _clean_string(os.getenv(env_name))
    if env_value:
        return env_value

    if deployment_key:
        deployment_value = _clean_string(str(deployment_manifest.get(deployment_key, "")))
        if deployment_value:
            return deployment_value

    return default


def _local_signer_fallback(provider_uri: str) -> str:
    lowered_uri = provider_uri.lower()
    if "127.0.0.1" in lowered_uri or "localhost" in lowered_uri:
        return HARDHAT_LOCAL_PRIVATE_KEY
    return ""


@dataclass
class Settings:
    deployment_manifest: Dict[str, Any] = field(default_factory=_load_deployment_manifest)
    deployment_file: str = ""
    web3_provider_uri: str = ""
    contract_address: str = ""
    risk_controller_address: str = ""
    monitor_contract_address: str = ""
    monitor_contract_name: str = ""
    monitor_event_name: str = ""
    guardian_signer_key: str = ""
    monitor_signer_key: str = ""
    port: int = 5000
    debug: bool = False
    auto_start_monitor: bool = False
    monitor_poll_interval_seconds: float = 5.0
    monitor_start_block: Optional[int] = None
    monitor_log_level: str = "INFO"
    eth_usd_price: float = 3000.0
    mev_gas_ratio_threshold: float = 2.5
    default_collateral_ratio: float = 1.5
    hedge_max_position_bps: int = 2500
    hedge_liquidation_threshold_bps: int = 8000
    hedge_rebalance_threshold_bps: int = 500
    rpc_retry_attempts: int = 3
    rpc_retry_delay_seconds: float = 2.0
    receipt_timeout_seconds: int = 120
    receipt_poll_latency_seconds: float = 2.0
    demo_log_limit: int = 25

    def __post_init__(self) -> None:
        deployment_path = _resolve_path(os.getenv("AEGIS_DEPLOYMENT_FILE", "deployments/localhost.json"))
        self.deployment_file = str(deployment_path) if deployment_path else ""
        self.web3_provider_uri = _select_string(
            "WEB3_PROVIDER_URI",
            self.deployment_manifest,
            default="http://127.0.0.1:8545",
        )
        self.contract_address = _select_string(
            "AEGIS_CONTRACT_ADDRESS",
            self.deployment_manifest,
            "guardianContractAddress",
        )
        self.risk_controller_address = _select_string(
            "RISK_CONTROLLER_ADDRESS",
            self.deployment_manifest,
            "riskControllerAddress",
        )
        self.monitor_contract_address = _select_string(
            "MONITOR_CONTRACT_ADDRESS",
            self.deployment_manifest,
            "monitorContractAddress",
        )
        self.monitor_contract_name = _select_string(
            "MONITOR_CONTRACT_NAME",
            self.deployment_manifest,
            "monitorContractName",
            default="AegisReactiveLiquidityGuardian",
        )
        self.monitor_event_name = _select_string(
            "MONITOR_EVENT_NAME",
            self.deployment_manifest,
            "monitorEventName",
            default="AbnormalLiquidityDetected",
        )

        shared_signer = _select_string("PRIVATE_KEY", self.deployment_manifest, default="")
        local_signer = _local_signer_fallback(self.web3_provider_uri)

        self.guardian_signer_key = _select_string(
            "GUARDIAN_SIGNER_KEY",
            self.deployment_manifest,
            default=shared_signer or local_signer,
        )
        self.monitor_signer_key = _select_string(
            "MONITOR_SIGNER_KEY",
            self.deployment_manifest,
            default=self.guardian_signer_key or shared_signer or local_signer,
        )

        self.port = int(os.getenv("PORT", "5000"))
        self.debug = _bool_env("FLASK_DEBUG", False)
        self.auto_start_monitor = _bool_env("AUTO_START_MONITOR", False)
        self.monitor_poll_interval_seconds = float(os.getenv("MONITOR_POLL_INTERVAL_SECONDS", "5"))
        self.monitor_start_block = _optional_int_env("MONITOR_START_BLOCK")
        self.monitor_log_level = os.getenv("MONITOR_LOG_LEVEL", "INFO")
        self.eth_usd_price = float(os.getenv("ETH_USD_PRICE", "3000"))
        self.mev_gas_ratio_threshold = float(os.getenv("MEV_GAS_RATIO_THRESHOLD", "2.5"))
        self.default_collateral_ratio = float(os.getenv("DEFAULT_COLLATERAL_RATIO", "1.5"))
        self.hedge_max_position_bps = int(os.getenv("HEDGE_MAX_POSITION_BPS", "2500"))
        self.hedge_liquidation_threshold_bps = int(
            os.getenv("HEDGE_LIQUIDATION_THRESHOLD_BPS", "8000")
        )
        self.hedge_rebalance_threshold_bps = int(
            os.getenv("HEDGE_REBALANCE_THRESHOLD_BPS", "500")
        )
        self.rpc_retry_attempts = int(os.getenv("MONITOR_RPC_RETRY_ATTEMPTS", "3"))
        self.rpc_retry_delay_seconds = float(os.getenv("MONITOR_RPC_RETRY_DELAY_SECONDS", "2"))
        self.receipt_timeout_seconds = int(os.getenv("MONITOR_TX_RECEIPT_TIMEOUT_SECONDS", "120"))
        self.receipt_poll_latency_seconds = float(
            os.getenv("MONITOR_TX_RECEIPT_POLL_LATENCY_SECONDS", "2")
        )
        self.demo_log_limit = int(os.getenv("DEMO_LOG_LIMIT", "25"))


settings = Settings()
