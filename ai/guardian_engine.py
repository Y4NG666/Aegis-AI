from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import logging
from threading import Lock
from typing import Any, Dict, Mapping

from web3 import Web3

from backend.blockchain import GuardianContractClient, RiskControllerClient, getStatus, pauseProtocol
from backend.config import settings

from .anomaly_detection import DeFiAnomalyDetector
from .risk_rules import RiskRuleset, TransactionSignal
from .strategy_engine import StrategyEngine


logger = logging.getLogger("aegis.guardian")


class GuardianEngine:
    def __init__(
        self,
        ruleset: RiskRuleset | None = None,
        anomaly_detector: DeFiAnomalyDetector | None = None,
        strategy_engine: StrategyEngine | None = None,
        *,
        provider_uri: str | None = None,
        guardian_contract_address: str | None = None,
        risk_controller_address: str | None = None,
        signer_key: str | None = None,
        guardian_client: GuardianContractClient | None = None,
        risk_controller_client: RiskControllerClient | None = None,
    ) -> None:
        self.ruleset = ruleset or RiskRuleset()
        self.anomaly_detector = anomaly_detector or DeFiAnomalyDetector()
        self.strategy_engine_model = strategy_engine or StrategyEngine()
        self.provider_uri = provider_uri or settings.web3_provider_uri
        self.guardian_contract_address = guardian_contract_address or settings.contract_address
        self.risk_controller_address = risk_controller_address or settings.risk_controller_address
        self.signer_key = signer_key or settings.monitor_signer_key
        self.guardian_client = guardian_client or GuardianContractClient(
            provider_uri=self.provider_uri,
            contract_address=self.guardian_contract_address,
            signer_key=settings.guardian_signer_key,
        )
        self.risk_controller_client = risk_controller_client or RiskControllerClient(
            provider_uri=self.provider_uri,
            contract_address=self.risk_controller_address,
            signer_key=self.signer_key,
        )
        self._state_lock = Lock()
        self._latest_result: Dict[str, Any] | None = None

    def evaluate(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        signal = TransactionSignal(
            wallet_address=payload["wallet_address"],
            transaction_value_eth=float(payload.get("transaction_value_eth", 0)),
            failed_transactions_last_hour=int(payload.get("failed_transactions_last_hour", 0)),
            unique_counterparties_last_day=int(payload.get("unique_counterparties_last_day", 0)),
            contract_interactions_last_day=int(payload.get("contract_interactions_last_day", 0)),
            flagged_by_siem=bool(payload.get("flagged_by_siem", False)),
        )
        assessment = self.ruleset.assess(signal)
        return {
            "wallet_address": signal.wallet_address,
            "assessment": assessment.to_dict(),
            "summary": self._build_summary(signal.wallet_address, assessment.label, assessment.risk_score),
        }

    def anomaly_detection(self, payload: Mapping[str, Any]) -> Dict[str, Any]:
        transaction_data = payload.get("transaction_data") or {}
        liquidity_changes = payload.get("liquidity_changes") or {}
        assessment = self.anomaly_detector.assess(transaction_data, liquidity_changes)
        return assessment.to_dict()

    def strategy_decision(
        self,
        anomaly_score: float,
        on_chain_data: Mapping[str, Any] | None = None,
    ) -> Dict[str, Any]:
        decision = self.strategy_engine_model.decide(anomaly_score, on_chain_data or {})
        return decision.to_dict()

    def strategy_engine(
        self,
        anomaly_score: float,
        on_chain_data: Mapping[str, Any] | None = None,
    ) -> Dict[str, Any]:
        return self.strategy_decision(anomaly_score, on_chain_data)

    def run_guardian(
        self,
        *,
        subject_address: str = "",
        transaction_data: Mapping[str, Any] | None = None,
        liquidity_changes: Mapping[str, Any] | None = None,
        on_chain_data: Mapping[str, Any] | None = None,
        summary_context: str = "Guardian runtime execution",
        record_onchain: bool = False,
        execute_onchain: bool = False,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "subject_address": subject_address,
            "wallet_address": subject_address,
            "transaction_data": dict(transaction_data or {}),
            "liquidity_changes": dict(liquidity_changes or {}),
            "on_chain_data": dict(on_chain_data or {}),
        }

        logger.info(
            "AI triggered subject_address=%s context=%s",
            subject_address or "<unknown>",
            summary_context,
        )

        anomaly = self.anomaly_detection(payload)
        risk_score = float(anomaly["risk_score"])
        logger.info(
            "risk score computed subject_address=%s risk_score=%.4f",
            subject_address or "<unknown>",
            risk_score,
        )

        resolved_on_chain_data = self._build_on_chain_data(payload)
        decision = self.strategy_decision(risk_score, resolved_on_chain_data)
        executions = self._execute_decision(
            subject_address=subject_address,
            action=str(decision["action"]),
            risk_score=risk_score,
            reasons=list(decision.get("reasons") or []),
            summary_context=summary_context,
            record_onchain=record_onchain,
            execute_onchain=execute_onchain,
        )

        result = {
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "subject_address": subject_address,
            "transaction_data": dict(transaction_data or {}),
            "liquidity_changes": dict(liquidity_changes or {}),
            "on_chain_data": resolved_on_chain_data,
            "anomaly": anomaly,
            "decision": decision,
            "executions": executions,
        }
        self._store_latest_result(result)

        logger.info(
            "Guardian run_guardian action=%s risk_score=%.4f execution=%s",
            decision["action"],
            risk_score,
            executions.get("pause")
            or executions.get("hedge")
            or executions.get("guardian")
            or "none",
        )
        return result

    def analyze_and_execute(self, payload: Mapping[str, Any]) -> Dict[str, Any]:
        result = self.run_guardian(
            subject_address=str(payload.get("subject_address") or payload.get("wallet_address") or ""),
            transaction_data=payload.get("transaction_data") or {},
            liquidity_changes=payload.get("liquidity_changes") or {},
            on_chain_data=payload.get("on_chain_data") or {},
            summary_context="GuardianEngine.analyze_and_execute",
            record_onchain=bool(payload.get("record_onchain", False)),
            execute_onchain=bool(payload.get("execute_onchain", True)),
        )
        return result

    def _build_on_chain_data(self, payload: Mapping[str, Any]) -> Dict[str, Any]:
        provided = dict(payload.get("on_chain_data") or {})
        status = self._load_risk_controller_status()

        if status:
            provided.setdefault("protocol_paused", bool(status.get("paused", False)))

        return provided

    def _load_risk_controller_status(self) -> Dict[str, Any]:
        if not self.provider_uri or not self.risk_controller_address:
            return {}

        try:
            status = getStatus(
                provider_uri=self.provider_uri,
                contract_address=self.risk_controller_address,
                signer_key=self.signer_key,
            )
            logger.info(
                "Loaded risk controller status paused=%s ready=%s",
                status.get("paused"),
                status.get("ready"),
            )
            return status
        except Exception as error:  # noqa: BLE001
            logger.exception("Unable to load risk controller status: %s", error)
            return {}

    def latest_result(self) -> Dict[str, Any] | None:
        with self._state_lock:
            return deepcopy(self._latest_result)

    def latest_risk_score(self) -> float:
        latest = self.latest_result()
        if not latest:
            return 0.0
        return float(latest.get("anomaly", {}).get("risk_score", 0.0))

    def _store_latest_result(self, result: Mapping[str, Any]) -> None:
        with self._state_lock:
            self._latest_result = deepcopy(dict(result))

    def _execute_decision(
        self,
        *,
        subject_address: str,
        action: str,
        risk_score: float,
        reasons: list[str],
        summary_context: str,
        record_onchain: bool,
        execute_onchain: bool,
    ) -> Dict[str, Any]:
        executions: Dict[str, Any] = {}

        if (
            record_onchain
            and subject_address
            and Web3.is_address(subject_address)
            and self.guardian_client.is_ready()
        ):
            try:
                executions["guardian"] = self.guardian_client.record_assessment(
                    wallet_address=subject_address,
                    risk_score=int(round(min(max(risk_score, 0.0), 1.0) * 100)),
                    summary=self._build_guardian_summary(
                        summary_context=summary_context,
                        action=action,
                        risk_score=risk_score,
                        reasons=reasons,
                    ),
                    active_guardian=action in {"pause", "hedge"},
                )
            except Exception as error:  # noqa: BLE001
                logger.exception("Guardian state update failed: %s", error)
                executions["guardian_error"] = str(error)

        if not execute_onchain:
            return executions

        if action == "pause":
            pause_execution = self._execute_pause()
            executions.update(pause_execution)
            return executions

        if action == "hedge" and self.risk_controller_client.is_ready():
            try:
                hedge_tx_hash = self.risk_controller_client.adjust_parameters(
                    settings.hedge_max_position_bps,
                    settings.hedge_liquidation_threshold_bps,
                    settings.hedge_rebalance_threshold_bps,
                )
                if hedge_tx_hash:
                    executions["hedge"] = hedge_tx_hash
            except Exception as error:  # noqa: BLE001
                logger.exception("Hedge execution failed: %s", error)
                executions["hedge_error"] = str(error)

        return executions

    def _execute_pause(self) -> Dict[str, Any]:
        if not self.provider_uri or not self.risk_controller_address or not self.signer_key:
            message = "Pause execution skipped because blockchain configuration is incomplete"
            logger.warning(message)
            return {"pause": None, "pause_error": message}

        try:
            tx_hash = pauseProtocol(
                provider_uri=self.provider_uri,
                contract_address=self.risk_controller_address,
                signer_key=self.signer_key,
            )
            return {"pause": tx_hash, "pause_error": None}
        except Exception as error:  # noqa: BLE001
            logger.exception("Pause execution failed: %s", error)
            return {"pause": None, "pause_error": str(error)}

    @staticmethod
    def _build_summary(wallet_address: str, label: str, risk_score: int) -> str:
        return f"Aegis AI marked wallet {wallet_address} as {label} with risk score {risk_score}/100."

    @staticmethod
    def _build_guardian_summary(
        *,
        summary_context: str,
        action: str,
        risk_score: float,
        reasons: list[str],
    ) -> str:
        primary_reason = reasons[0] if reasons else "no explicit reason recorded"
        return (
            f"{summary_context} | action={action} | anomaly_score={risk_score:.4f} "
            f"| reason={primary_reason}"
        )
