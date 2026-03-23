from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Mapping


@dataclass
class TransactionData:
    tx_value_usd: float = 0.0
    slippage_bps: float = 0.0
    gas_spike_ratio: float = 1.0
    failed_tx_count_1h: int = 0
    unique_protocols_1h: int = 0
    flash_loan_detected: bool = False
    mev_flagged: bool = False


@dataclass
class LiquidityChange:
    liquidity_before_usd: float = 0.0
    liquidity_after_usd: float = 0.0
    reserve0_change_pct: float = 0.0
    reserve1_change_pct: float = 0.0


@dataclass
class AnomalyAssessment:
    risk_score: float
    feature_scores: Dict[str, float] = field(default_factory=dict)
    reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk_score": self.risk_score,
            "feature_scores": self.feature_scores,
            "reasons": self.reasons,
        }


class DeFiAnomalyDetector:
    """
    Simple rule-based anomaly detector for DeFi transactions and liquidity changes.

    The detector converts transaction and liquidity signals into normalized feature
    scores, then aggregates them into a final risk score in the range [0.0, 1.0].
    """

    def __init__(
        self,
        tx_value_threshold_usd: float = 250_000.0,
        slippage_threshold_bps: float = 1_000.0,
        gas_spike_threshold: float = 4.0,
        failed_tx_threshold: int = 10,
        protocol_burst_threshold: int = 8,
        liquidity_change_threshold_pct: float = 30.0,
    ) -> None:
        self.tx_value_threshold_usd = tx_value_threshold_usd
        self.slippage_threshold_bps = slippage_threshold_bps
        self.gas_spike_threshold = gas_spike_threshold
        self.failed_tx_threshold = failed_tx_threshold
        self.protocol_burst_threshold = protocol_burst_threshold
        self.liquidity_change_threshold_pct = liquidity_change_threshold_pct

    def assess(
        self,
        transaction_data: Mapping[str, Any] | TransactionData,
        liquidity_changes: Mapping[str, Any] | LiquidityChange | None = None,
    ) -> AnomalyAssessment:
        tx = self._coerce_transaction_data(transaction_data)
        liq = self._coerce_liquidity_changes(liquidity_changes or {})

        feature_scores: Dict[str, float] = {
            "tx_size": self._normalize(tx.tx_value_usd, self.tx_value_threshold_usd),
            "slippage": self._normalize(tx.slippage_bps, self.slippage_threshold_bps),
            "gas_spike": self._normalize(
                max(tx.gas_spike_ratio - 1.0, 0.0),
                max(self.gas_spike_threshold - 1.0, 1.0),
            ),
            "failed_transactions": self._normalize(
                float(tx.failed_tx_count_1h),
                float(self.failed_tx_threshold),
            ),
            "protocol_burst": self._normalize(
                float(tx.unique_protocols_1h),
                float(self.protocol_burst_threshold),
            ),
            "liquidity_shock": self._liquidity_shock_score(liq),
            "flash_loan": 1.0 if tx.flash_loan_detected else 0.0,
            "mev_signal": 1.0 if tx.mev_flagged else 0.0,
        }

        weights = {
            "tx_size": 0.18,
            "slippage": 0.16,
            "gas_spike": 0.10,
            "failed_transactions": 0.12,
            "protocol_burst": 0.10,
            "liquidity_shock": 0.24,
            "flash_loan": 0.06,
            "mev_signal": 0.04,
        }

        raw_score = sum(feature_scores[name] * weights[name] for name in weights)
        risk_score = round(min(max(raw_score, 0.0), 1.0), 4)

        reasons: List[str] = []
        if feature_scores["tx_size"] >= 0.7:
            reasons.append("Large transaction size relative to configured threshold")
        if feature_scores["slippage"] >= 0.7:
            reasons.append("High slippage may indicate stressed or manipulated execution")
        if feature_scores["gas_spike"] >= 0.7:
            reasons.append("Gas usage spiked above the normal operating range")
        if feature_scores["failed_transactions"] >= 0.7:
            reasons.append("Repeated failed transactions detected in a short window")
        if feature_scores["protocol_burst"] >= 0.7:
            reasons.append("Rapid interactions across many protocols were observed")
        if feature_scores["liquidity_shock"] >= 0.7:
            reasons.append("Liquidity changed abruptly and may indicate pool stress")
        if tx.flash_loan_detected:
            reasons.append("Flash-loan behavior was flagged")
        if tx.mev_flagged:
            reasons.append("MEV-related activity was flagged")
        if not reasons:
            reasons.append("No major anomaly indicators exceeded warning thresholds")

        return AnomalyAssessment(
            risk_score=risk_score,
            feature_scores=feature_scores,
            reasons=reasons,
        )

    def _coerce_transaction_data(
        self,
        data: Mapping[str, Any] | TransactionData,
    ) -> TransactionData:
        if isinstance(data, TransactionData):
            return data

        return TransactionData(
            tx_value_usd=float(data.get("tx_value_usd", 0.0)),
            slippage_bps=float(data.get("slippage_bps", 0.0)),
            gas_spike_ratio=float(data.get("gas_spike_ratio", 1.0)),
            failed_tx_count_1h=int(data.get("failed_tx_count_1h", 0)),
            unique_protocols_1h=int(data.get("unique_protocols_1h", 0)),
            flash_loan_detected=bool(data.get("flash_loan_detected", False)),
            mev_flagged=bool(data.get("mev_flagged", False)),
        )

    def _coerce_liquidity_changes(
        self,
        data: Mapping[str, Any] | LiquidityChange,
    ) -> LiquidityChange:
        if isinstance(data, LiquidityChange):
            return data

        return LiquidityChange(
            liquidity_before_usd=float(data.get("liquidity_before_usd", 0.0)),
            liquidity_after_usd=float(data.get("liquidity_after_usd", 0.0)),
            reserve0_change_pct=float(data.get("reserve0_change_pct", 0.0)),
            reserve1_change_pct=float(data.get("reserve1_change_pct", 0.0)),
        )

    def _liquidity_shock_score(self, liquidity: LiquidityChange) -> float:
        total_liquidity_pct = self._total_liquidity_change_pct(
            liquidity.liquidity_before_usd,
            liquidity.liquidity_after_usd,
        )
        reserve_change_pct = max(
            abs(liquidity.reserve0_change_pct),
            abs(liquidity.reserve1_change_pct),
        )
        strongest_signal = max(total_liquidity_pct, reserve_change_pct)
        return self._normalize(strongest_signal, self.liquidity_change_threshold_pct)

    @staticmethod
    def _total_liquidity_change_pct(before: float, after: float) -> float:
        if before <= 0:
            return 100.0 if after > 0 else 0.0
        return abs(after - before) / before * 100.0

    @staticmethod
    def _normalize(value: float, threshold: float) -> float:
        if threshold <= 0:
            return 0.0
        return min(max(value / threshold, 0.0), 1.0)


def calculate_risk_score(
    transaction_data: Mapping[str, Any],
    liquidity_changes: Mapping[str, Any] | None = None,
) -> float:
    """
    Convenience helper for callers that only need the final 0-1 score.
    """

    detector = DeFiAnomalyDetector()
    return detector.assess(transaction_data, liquidity_changes).risk_score
