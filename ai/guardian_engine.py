from __future__ import annotations

from typing import Any, Dict

from .risk_rules import RiskRuleset, TransactionSignal


class GuardianEngine:
    def __init__(self, ruleset: RiskRuleset | None = None) -> None:
        self.ruleset = ruleset or RiskRuleset()

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

    @staticmethod
    def _build_summary(wallet_address: str, label: str, risk_score: int) -> str:
        return f"Aegis AI marked wallet {wallet_address} as {label} with risk score {risk_score}/100."
