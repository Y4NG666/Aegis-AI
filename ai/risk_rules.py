from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import List


@dataclass
class TransactionSignal:
    wallet_address: str
    transaction_value_eth: float
    failed_transactions_last_hour: int
    unique_counterparties_last_day: int
    contract_interactions_last_day: int
    flagged_by_siem: bool = False


@dataclass
class GuardianAssessment:
    risk_score: int
    label: str
    action: str
    active_guardian: bool
    reasons: List[str]

    def to_dict(self) -> dict:
        return asdict(self)


class RiskRuleset:
    def assess(self, signal: TransactionSignal) -> GuardianAssessment:
        score = 0
        reasons: List[str] = []

        if signal.transaction_value_eth >= 50:
            score += 35
            reasons.append("Large transaction value detected")
        elif signal.transaction_value_eth >= 10:
            score += 15
            reasons.append("Elevated transaction value detected")

        if signal.failed_transactions_last_hour >= 5:
            score += 25
            reasons.append("Repeated failed transactions suggest abnormal behavior")

        if signal.unique_counterparties_last_day >= 20:
            score += 20
            reasons.append("Wallet has an unusually high number of counterparties")

        if signal.contract_interactions_last_day >= 30:
            score += 15
            reasons.append("High volume of contract interactions observed")

        if signal.flagged_by_siem:
            score += 30
            reasons.append("External security tooling flagged this wallet")

        score = min(score, 100)

        if score >= 70:
            return GuardianAssessment(
                risk_score=score,
                label="critical",
                action="freeze-and-alert",
                active_guardian=True,
                reasons=reasons or ["Critical risk threshold exceeded"],
            )

        if score >= 40:
            return GuardianAssessment(
                risk_score=score,
                label="warning",
                action="monitor-and-notify",
                active_guardian=True,
                reasons=reasons or ["Warning risk threshold exceeded"],
            )

        return GuardianAssessment(
            risk_score=score,
            label="normal",
            action="allow",
            active_guardian=False,
            reasons=reasons or ["Activity is within baseline thresholds"],
        )
