from __future__ import annotations

from typing import Any, Dict, Mapping

from web3 import Web3

from ai.anomaly_detection import DeFiAnomalyDetector
from ai.strategy_engine import StrategyEngine
from backend.blockchain import GuardianContractClient, RiskControllerClient


class DefenseOrchestrator:
    def __init__(
        self,
        guardian_client: GuardianContractClient,
        risk_controller: RiskControllerClient,
        *,
        anomaly_detector: DeFiAnomalyDetector | None = None,
        strategy_engine: StrategyEngine | None = None,
        hedge_max_position_bps: int = 2500,
        hedge_liquidation_threshold_bps: int = 8000,
        hedge_rebalance_threshold_bps: int = 500,
    ) -> None:
        self.guardian_client = guardian_client
        self.risk_controller = risk_controller
        self.anomaly_detector = anomaly_detector or DeFiAnomalyDetector()
        self.strategy_engine = strategy_engine or StrategyEngine()
        self.hedge_max_position_bps = hedge_max_position_bps
        self.hedge_liquidation_threshold_bps = hedge_liquidation_threshold_bps
        self.hedge_rebalance_threshold_bps = hedge_rebalance_threshold_bps

    def analyze(
        self,
        transaction_data: Mapping[str, Any],
        liquidity_changes: Mapping[str, Any] | None = None,
        on_chain_data: Mapping[str, Any] | None = None,
    ) -> Dict[str, Any]:
        anomaly = self.anomaly_detector.assess(transaction_data, liquidity_changes)
        decision = self.strategy_engine.decide(anomaly.risk_score, on_chain_data or {})
        return {
            "anomaly": anomaly.to_dict(),
            "decision": decision.to_dict(),
            "on_chain_data": dict(on_chain_data or {}),
            "execution_ready": {
                "guardian": self.guardian_client.is_ready(),
                "risk_controller": self.risk_controller.is_ready(),
            },
        }

    def evaluate_and_execute(
        self,
        subject_address: str,
        transaction_data: Mapping[str, Any],
        liquidity_changes: Mapping[str, Any] | None = None,
        on_chain_data: Mapping[str, Any] | None = None,
        *,
        summary_context: str = "Automated defense evaluation",
        record_guardian: bool = False,
        execute_onchain: bool = False,
    ) -> Dict[str, Any]:
        result = self.analyze(transaction_data, liquidity_changes, on_chain_data)
        result["subject_address"] = subject_address
        result["executions"] = {}

        if not execute_onchain and not record_guardian:
            return result

        anomaly = result["anomaly"]
        decision = result["decision"]
        executions = self.execute(
            subject_address=subject_address,
            action=str(decision["action"]),
            risk_score=float(anomaly["risk_score"]),
            reasons=decision.get("reasons", []),
            summary_context=summary_context,
            record_guardian=record_guardian,
            execute_risk_controller=execute_onchain,
        )
        result["executions"] = executions
        return result

    def execute(
        self,
        *,
        subject_address: str,
        action: str,
        risk_score: float,
        reasons: list[str] | None = None,
        summary_context: str,
        record_guardian: bool,
        execute_risk_controller: bool,
    ) -> Dict[str, str]:
        executions: Dict[str, str] = {}
        summary = self._build_summary(summary_context, action, risk_score, reasons or [])

        if (
            record_guardian
            and subject_address
            and Web3.is_address(subject_address)
            and self.guardian_client.is_ready()
        ):
            executions["guardian"] = self.guardian_client.record_assessment(
                wallet_address=subject_address,
                risk_score=int(round(min(max(risk_score, 0.0), 1.0) * 100)),
                summary=summary,
                active_guardian=action in {"pause", "hedge"},
            )

        if not execute_risk_controller or not self.risk_controller.is_ready():
            return executions

        if action == "pause" and not self.risk_controller.paused():
            pause_tx = self.risk_controller.pause_protocol()
            if pause_tx:
                executions["pause"] = pause_tx
        elif action == "hedge":
            hedge_tx = self.risk_controller.adjust_parameters(
                self.hedge_max_position_bps,
                self.hedge_liquidation_threshold_bps,
                self.hedge_rebalance_threshold_bps,
            )
            if hedge_tx:
                executions["hedge"] = hedge_tx

        return executions

    @staticmethod
    def _build_summary(
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
