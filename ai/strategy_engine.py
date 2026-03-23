from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Mapping, Literal


ActionDecision = Literal["pause", "hedge", "alert"]


@dataclass
class OnChainData:
    protocol_paused: bool = False
    liquidity_drop_pct: float = 0.0
    volatility_index: float = 0.0
    collateral_ratio: float = 1.5
    pool_utilization: float = 0.0
    active_exploit_flag: bool = False


@dataclass
class StrategyDecision:
    action: ActionDecision
    confidence: float
    reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "action": self.action,
            "confidence": self.confidence,
            "reasons": self.reasons,
        }


class StrategyEngine:
    """
    Converts anomaly scores and on-chain conditions into a single control action.
    """

    def __init__(
        self,
        pause_score_threshold: float = 0.85,
        hedge_score_threshold: float = 0.55,
        critical_liquidity_drop_pct: float = 35.0,
        elevated_liquidity_drop_pct: float = 15.0,
        critical_volatility_index: float = 0.85,
        elevated_volatility_index: float = 0.55,
        minimum_safe_collateral_ratio: float = 1.1,
        elevated_pool_utilization: float = 0.8,
    ) -> None:
        self.pause_score_threshold = pause_score_threshold
        self.hedge_score_threshold = hedge_score_threshold
        self.critical_liquidity_drop_pct = critical_liquidity_drop_pct
        self.elevated_liquidity_drop_pct = elevated_liquidity_drop_pct
        self.critical_volatility_index = critical_volatility_index
        self.elevated_volatility_index = elevated_volatility_index
        self.minimum_safe_collateral_ratio = minimum_safe_collateral_ratio
        self.elevated_pool_utilization = elevated_pool_utilization

    def decide(
        self,
        anomaly_score: float,
        on_chain_data: Mapping[str, Any] | OnChainData,
    ) -> StrategyDecision:
        score = min(max(float(anomaly_score), 0.0), 1.0)
        chain = self._coerce_on_chain_data(on_chain_data)
        reasons: List[str] = []

        severe_conditions = 0
        elevated_conditions = 0

        if chain.active_exploit_flag:
            severe_conditions += 1
            reasons.append("An active exploit flag is set on-chain")

        if chain.liquidity_drop_pct >= self.critical_liquidity_drop_pct:
            severe_conditions += 1
            reasons.append("Liquidity dropped beyond the critical threshold")
        elif chain.liquidity_drop_pct >= self.elevated_liquidity_drop_pct:
            elevated_conditions += 1
            reasons.append("Liquidity drop is elevated")

        if chain.volatility_index >= self.critical_volatility_index:
            severe_conditions += 1
            reasons.append("Volatility is in the critical range")
        elif chain.volatility_index >= self.elevated_volatility_index:
            elevated_conditions += 1
            reasons.append("Volatility is elevated")

        if chain.collateral_ratio <= self.minimum_safe_collateral_ratio:
            severe_conditions += 1
            reasons.append("Collateral ratio is near or below the safe minimum")

        if chain.pool_utilization >= self.elevated_pool_utilization:
            elevated_conditions += 1
            reasons.append("Pool utilization is stretched")

        if chain.protocol_paused:
            reasons.append("Protocol is already paused on-chain")

        if (
            not chain.protocol_paused and
            (
                score >= self.pause_score_threshold or
                severe_conditions >= 2 or
                (score >= 0.7 and severe_conditions >= 1)
            )
        ):
            return StrategyDecision(
                action="pause",
                confidence=round(max(score, 0.85), 4),
                reasons=reasons or ["Risk is high enough to pause protocol operations"],
            )

        if (
            score >= self.hedge_score_threshold or
            severe_conditions == 1 or
            elevated_conditions >= 2
        ):
            return StrategyDecision(
                action="hedge",
                confidence=round(max(score, 0.6), 4),
                reasons=reasons or ["Risk conditions favor defensive hedging"],
            )

        return StrategyDecision(
            action="alert",
            confidence=round(max(score, 0.35), 4),
            reasons=reasons or ["Conditions do not yet justify stronger intervention"],
        )

    @staticmethod
    def _coerce_on_chain_data(data: Mapping[str, Any] | OnChainData) -> OnChainData:
        if isinstance(data, OnChainData):
            return data

        return OnChainData(
            protocol_paused=bool(data.get("protocol_paused", False)),
            liquidity_drop_pct=float(data.get("liquidity_drop_pct", 0.0)),
            volatility_index=float(data.get("volatility_index", 0.0)),
            collateral_ratio=float(data.get("collateral_ratio", 1.5)),
            pool_utilization=float(data.get("pool_utilization", 0.0)),
            active_exploit_flag=bool(data.get("active_exploit_flag", False)),
        )


def decide_action(anomaly_score: float, on_chain_data: Mapping[str, Any]) -> Dict[str, Any]:
    """
    Convenience helper for callers that want a plain dictionary response.
    """

    engine = StrategyEngine()
    return engine.decide(anomaly_score, on_chain_data).to_dict()
