from __future__ import annotations

import logging
from typing import Any

from flask import Flask, jsonify, request

from ai import GuardianEngine
from backend.blockchain import GuardianContractClient, RiskControllerClient
from backend.config import settings
from backend.event_listener import DeFiEventMonitor, configure_logging
from backend.pipeline import DefenseOrchestrator


configure_logging(settings.monitor_log_level)
logger = logging.getLogger("aegis.api")


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


app = Flask(__name__)
engine = GuardianEngine()
guardian_client = GuardianContractClient(
    provider_uri=settings.web3_provider_uri,
    contract_address=settings.contract_address,
    signer_key=settings.guardian_signer_key,
)
risk_controller_client = RiskControllerClient(
    provider_uri=settings.web3_provider_uri,
    contract_address=settings.risk_controller_address,
    signer_key=settings.monitor_signer_key,
)
defense_orchestrator = DefenseOrchestrator(
    guardian_client=guardian_client,
    risk_controller=risk_controller_client,
    hedge_max_position_bps=settings.hedge_max_position_bps,
    hedge_liquidation_threshold_bps=settings.hedge_liquidation_threshold_bps,
    hedge_rebalance_threshold_bps=settings.hedge_rebalance_threshold_bps,
)

monitor_service: DeFiEventMonitor | None = None
monitor_error: str | None = None

if settings.monitor_contract_address:
    try:
        monitor_service = DeFiEventMonitor(settings)
        if settings.auto_start_monitor:
            monitor_service.start()
    except Exception as error:  # noqa: BLE001
        monitor_error = str(error)
        logger.exception("Unable to initialize event monitor: %s", error)


@app.get("/health")
def health() -> tuple[dict, int]:
    return {
        "status": "ok",
        "web3_connected": guardian_client.w3.is_connected(),
        "deployment_file": settings.deployment_file or None,
        "guardian_contract_ready": guardian_client.is_ready(),
        "risk_controller_ready": risk_controller_client.is_ready(),
        "monitor_configured": monitor_service is not None,
        "monitor_running": monitor_service.is_running() if monitor_service else False,
        "monitor_error": monitor_error,
    }, 200


@app.get("/api/monitor/status")
def monitor_status() -> tuple[dict, int]:
    if monitor_service is None:
        return {
            "configured": False,
            "running": False,
            "error": monitor_error or "Monitor contract is not configured",
        }, 200

    return jsonify(monitor_service.snapshot()), 200


@app.get("/api/risk-controller/status")
def risk_controller_status() -> tuple[dict, int]:
    if not risk_controller_client.contract:
        return {"error": "Risk controller is not configured"}, 503

    return {
        "paused": risk_controller_client.paused(),
        "parameters": risk_controller_client.parameters(),
    }, 200


@app.get("/api/guardian/<wallet_address>")
def guardian_state(wallet_address: str) -> tuple[dict, int]:
    if not guardian_client.contract:
        return {"error": "Guardian contract is not configured"}, 503

    try:
        state = guardian_client.get_guardian_state(wallet_address)
    except Exception as error:  # noqa: BLE001
        return {"error": str(error)}, 400

    return jsonify(state), 200


@app.post("/api/assess")
def assess_wallet() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}

    if "wallet_address" not in payload:
        return {"error": "wallet_address is required"}, 400

    result = engine.evaluate(payload)
    tx_hash = None

    if _as_bool(payload.get("record_onchain")) and guardian_client.is_ready():
        assessment = result["assessment"]
        tx_hash = guardian_client.record_assessment(
            wallet_address=result["wallet_address"],
            risk_score=assessment["risk_score"],
            summary=result["summary"],
            active_guardian=assessment["active_guardian"],
        )

    response = {**result, "transaction_hash": tx_hash}
    return jsonify(response), 200


@app.post("/api/anomaly/detect")
def detect_anomaly() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    transaction_data = payload.get("transaction_data") or {}
    liquidity_changes = payload.get("liquidity_changes") or {}
    on_chain_data = payload.get("on_chain_data") or {}
    subject_address = (
        payload.get("subject_address")
        or payload.get("wallet_address")
        or payload.get("pair_address")
        or ""
    )

    if not transaction_data:
        return {"error": "transaction_data is required"}, 400

    result = defense_orchestrator.evaluate_and_execute(
        subject_address=subject_address,
        transaction_data=transaction_data,
        liquidity_changes=liquidity_changes,
        on_chain_data=on_chain_data,
        summary_context="api=/api/anomaly/detect",
        record_guardian=_as_bool(payload.get("record_onchain")),
        execute_onchain=_as_bool(payload.get("execute_onchain")),
    )
    return jsonify(result), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=settings.port, debug=settings.debug)
