from __future__ import annotations

import json
import logging
import time
from typing import Any, Iterator

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ai import GuardianEngine
from backend.blockchain import (
    GuardianContractClient,
    ReactiveLiquidityGuardianClient,
    RiskControllerClient,
)
from backend.config import settings
from backend.event_listener import DeFiEventMonitor, configure_logging
from backend.monitor import RealTimeContractMonitor
from backend.pipeline import DefenseOrchestrator


configure_logging(settings.monitor_log_level)
logger = logging.getLogger("aegis.api")


class AssessRequest(BaseModel):
    wallet_address: str
    transaction_value_eth: float = 0.0
    failed_transactions_last_hour: int = 0
    unique_counterparties_last_day: int = 0
    contract_interactions_last_day: int = 0
    flagged_by_siem: bool = False
    record_onchain: bool = False


class AnalyzeRequest(BaseModel):
    subject_address: str = ""
    wallet_address: str = ""
    pair_address: str = ""
    transaction_data: dict[str, Any] = Field(default_factory=dict)
    liquidity_changes: dict[str, Any] = Field(default_factory=dict)
    on_chain_data: dict[str, Any] = Field(default_factory=dict)
    record_onchain: bool | None = None
    execute_onchain: bool | None = None


class ExecuteRequest(AnalyzeRequest):
    pass


class DemoTriggerRequest(BaseModel):
    baseline_reserves: dict[str, int] = Field(default_factory=dict)
    event_reserves: dict[str, int] = Field(default_factory=dict)


app = FastAPI(
    title="Aegis AI Guardian API",
    version="1.0.0",
    description="FastAPI control plane for AI analysis, contract reads, and contract execution.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("Incoming request %s %s", request.method, request.url.path)
    response = await call_next(request)
    logger.info(
        "Completed request %s %s with %s",
        request.method,
        request.url.path,
        response.status_code,
    )
    return response

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
reactive_guardian_client = ReactiveLiquidityGuardianClient(
    provider_uri=settings.web3_provider_uri,
    contract_address=settings.monitor_contract_address,
    signer_key=settings.monitor_signer_key,
)
engine = GuardianEngine(
    provider_uri=settings.web3_provider_uri,
    guardian_contract_address=settings.contract_address,
    risk_controller_address=settings.risk_controller_address,
    signer_key=settings.monitor_signer_key,
    guardian_client=guardian_client,
    risk_controller_client=risk_controller_client,
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
        monitor_service = RealTimeContractMonitor(
            settings,
            guardian_engine=engine,
            w3=reactive_guardian_client.w3,
        )
        if settings.auto_start_monitor:
            monitor_service.start()
    except Exception as error:  # noqa: BLE001
        monitor_error = str(error)
        logger.exception("Unable to initialize event monitor: %s", error)


def _default_subject_address() -> str:
    manifest = settings.deployment_manifest
    return str(
        manifest.get("demoPairAddress")
        or settings.monitor_contract_address
        or settings.contract_address
        or ""
    )


def _resolve_subject_address(payload: AnalyzeRequest) -> str:
    return (
        payload.subject_address
        or payload.wallet_address
        or payload.pair_address
        or ""
    )


def _risk_controller_state() -> dict[str, Any]:
    if not risk_controller_client.contract:
        return {
            "ready": False,
            "paused": False,
            "parameters": None,
        }

    return {
        "ready": risk_controller_client.is_ready(),
        "paused": risk_controller_client.paused(),
        "parameters": risk_controller_client.parameters(),
    }


def _guardian_state(subject_address: str) -> dict[str, Any]:
    if not guardian_client.contract or not subject_address:
        return {
            "ready": False,
            "subject_address": subject_address,
            "state": None,
            "error": None,
        }

    try:
        state = guardian_client.get_guardian_state(subject_address)
        return {
            "ready": guardian_client.is_ready(),
            "subject_address": subject_address,
            "state": state,
            "error": None,
        }
    except Exception as error:  # noqa: BLE001
        return {
            "ready": guardian_client.is_ready(),
            "subject_address": subject_address,
            "state": None,
            "error": str(error),
        }


def _monitor_state() -> dict[str, Any]:
    if monitor_service is None:
        return {
            "configured": False,
            "running": False,
            "error": monitor_error or "Monitor contract is not configured",
            "recent_events": [],
        }

    snapshot = monitor_service.snapshot()
    snapshot["configured"] = True
    return snapshot


def _reactive_guardian_state() -> dict[str, Any]:
    if not reactive_guardian_client.contract:
        return {
            "ready": False,
            "status": None,
        }

    try:
        return {
            "ready": reactive_guardian_client.is_ready(),
            "status": reactive_guardian_client.status(),
        }
    except Exception as error:  # noqa: BLE001
        return {
            "ready": reactive_guardian_client.is_ready(),
            "status": None,
            "error": str(error),
        }


def _system_state(subject_address: str | None = None) -> dict[str, Any]:
    tracked_subject = subject_address or _default_subject_address()
    monitor_state = _monitor_state()
    recent_events = monitor_state.get("recent_events", []) if monitor_state else []
    latest_event = recent_events[0] if recent_events else None
    latest_ai_result = engine.latest_result()
    latest_risk_score = int(round(engine.latest_risk_score() * 100)) if latest_ai_result else None

    return {
        "status": "ok",
        "backend": {
            "web3_connected": guardian_client.w3.is_connected(),
            "deployment_file": settings.deployment_file or None,
            "monitor_error": monitor_error,
        },
        "deployment": {
            "network": settings.deployment_manifest.get("network"),
            "chain_id": settings.deployment_manifest.get("chainId"),
            "guardian_contract_address": settings.contract_address,
            "risk_controller_address": settings.risk_controller_address,
            "monitor_contract_address": settings.monitor_contract_address,
            "demo_pair_address": settings.deployment_manifest.get("demoPairAddress"),
        },
        "contracts": {
            "guardian": _guardian_state(tracked_subject),
            "risk_controller": _risk_controller_state(),
            "reactive_guardian": _reactive_guardian_state(),
        },
        "monitor": monitor_state,
        "ai": {
            "latest_risk_score": latest_risk_score,
            "latest_result": latest_ai_result,
        },
        "latest_event": latest_event,
    }


def _monitor_processed_events() -> int:
    if monitor_service is None:
        return 0

    return int(monitor_service.snapshot().get("processed_events") or 0)


def _wait_for_monitored_event(
    expected_tx_hash: str,
    previous_count: int,
    *,
    timeout_seconds: float = 20.0,
    poll_interval_seconds: float = 0.5,
) -> dict[str, Any] | None:
    if monitor_service is None:
        return None

    deadline = time.monotonic() + timeout_seconds
    expected_hash = expected_tx_hash.lower()

    while time.monotonic() < deadline:
        snapshot = monitor_service.snapshot()
        recent_events = snapshot.get("recent_events", [])

        for recent_event in recent_events:
            if str(recent_event.get("transaction_hash", "")).lower() == expected_hash:
                return recent_event

        if int(snapshot.get("processed_events") or 0) > previous_count and recent_events:
            return recent_events[0]

        time.sleep(poll_interval_seconds)

    return None


def _execution_transaction_hash(executions: dict[str, Any], fallback_tx_hash: str) -> str:
    for key in ("pause", "hedge", "guardian"):
        candidate = executions.get(key)
        if candidate:
            return str(candidate)
    return fallback_tx_hash


def _demo_logs(
    analyzed_event: dict[str, Any] | None,
    abnormal_tx_hash: str,
) -> list[dict[str, str]]:
    if not analyzed_event:
        return [
            {"label": "Event detected", "value": "Pending monitor confirmation"},
            {"label": "Risk score", "value": "Pending"},
            {"label": "Decision", "value": "Pending"},
            {"label": "Transaction hash", "value": abnormal_tx_hash},
        ]

    anomaly = analyzed_event.get("anomaly", {})
    decision = analyzed_event.get("decision", {})
    executions = analyzed_event.get("executions", {})
    risk_score = int(round(float(anomaly.get("risk_score", 0.0)) * 100))
    action = str(decision.get("action", "monitor")).upper()
    tx_hash = _execution_transaction_hash(executions, abnormal_tx_hash)

    return [
        {
            "label": "Event detected",
            "value": f"Abnormal liquidity event confirmed in tx {analyzed_event.get('transaction_hash', abnormal_tx_hash)}",
        },
        {"label": "Risk score", "value": f"{risk_score}%"},
        {"label": "Decision", "value": action},
        {"label": "Transaction hash", "value": tx_hash},
    ]


def _stream_system_state(subject_address: str | None = None) -> Iterator[str]:
    last_payload = ""
    while True:
        payload = json.dumps(_system_state(subject_address))
        if payload != last_payload:
            yield f"event: system\ndata: {payload}\n\n"
            last_payload = payload
        else:
            yield ": keep-alive\n\n"
        time.sleep(2)


def _analyze_payload(
    payload: AnalyzeRequest,
    *,
    execute_onchain: bool,
    record_onchain: bool,
    summary_context: str,
) -> dict[str, Any]:
    if not payload.transaction_data:
        raise HTTPException(status_code=400, detail="transaction_data is required")

    return defense_orchestrator.evaluate_and_execute(
        subject_address=_resolve_subject_address(payload),
        transaction_data=payload.transaction_data,
        liquidity_changes=payload.liquidity_changes,
        on_chain_data=payload.on_chain_data,
        summary_context=summary_context,
        record_guardian=record_onchain,
        execute_onchain=execute_onchain,
    )


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "web3_connected": guardian_client.w3.is_connected(),
        "deployment_file": settings.deployment_file or None,
        "guardian_contract_ready": guardian_client.is_ready(),
        "risk_controller_ready": risk_controller_client.is_ready(),
        "monitor_contract_ready": reactive_guardian_client.is_ready(),
        "monitor_configured": monitor_service is not None,
        "monitor_running": monitor_service.is_running() if monitor_service else False,
        "monitor_error": monitor_error,
    }


@app.get("/status")
@app.get("/api/system/state")
def get_status(subject_address: str | None = Query(default=None)) -> dict[str, Any]:
    normalized_subject = subject_address.strip() if subject_address else None
    return _system_state(normalized_subject)


@app.post("/analyze")
def analyze(payload: AnalyzeRequest) -> dict[str, Any]:
    return _analyze_payload(
        payload,
        execute_onchain=False,
        record_onchain=bool(payload.record_onchain),
        summary_context="api=/analyze",
    )


@app.post("/execute")
def execute(payload: ExecuteRequest) -> dict[str, Any]:
    record_onchain = True if payload.record_onchain is None else bool(payload.record_onchain)
    execute_onchain = True if payload.execute_onchain is None else bool(payload.execute_onchain)
    return _analyze_payload(
        payload,
        execute_onchain=execute_onchain,
        record_onchain=record_onchain,
        summary_context="api=/execute",
    )


@app.post("/api/anomaly/detect")
def detect_anomaly(payload: AnalyzeRequest) -> dict[str, Any]:
    return _analyze_payload(
        payload,
        execute_onchain=bool(payload.execute_onchain),
        record_onchain=bool(payload.record_onchain),
        summary_context="api=/api/anomaly/detect",
    )


@app.post("/api/assess")
def assess_wallet(payload: AssessRequest) -> dict[str, Any]:
    result = engine.evaluate(payload.model_dump())
    tx_hash = None

    if payload.record_onchain and guardian_client.is_ready():
        assessment = result["assessment"]
        tx_hash = guardian_client.record_assessment(
            wallet_address=result["wallet_address"],
            risk_score=assessment["risk_score"],
            summary=result["summary"],
            active_guardian=assessment["active_guardian"],
        )

    return {**result, "transaction_hash": tx_hash}


@app.get("/api/monitor/status")
def monitor_status() -> dict[str, Any]:
    if monitor_service is None:
        return {
            "configured": False,
            "running": False,
            "error": monitor_error or "Monitor contract is not configured",
        }

    return monitor_service.snapshot()


@app.post("/api/monitor/start")
def monitor_start() -> dict[str, Any]:
    if monitor_service is None:
        raise HTTPException(
            status_code=503,
            detail=monitor_error or "Monitor contract is not configured",
        )

    monitor_service.start()
    return monitor_service.snapshot()


@app.get("/api/system/stream")
def system_stream(subject_address: str | None = Query(default=None)) -> StreamingResponse:
    normalized_subject = subject_address.strip() if subject_address else None
    return StreamingResponse(
        _stream_system_state(normalized_subject),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/risk-controller/status")
def risk_controller_status() -> dict[str, Any]:
    if not risk_controller_client.contract:
        raise HTTPException(status_code=503, detail="Risk controller is not configured")

    return {
        "paused": risk_controller_client.paused(),
        "parameters": risk_controller_client.parameters(),
    }


@app.get("/api/guardian/{wallet_address}")
def guardian_state(wallet_address: str) -> dict[str, Any]:
    if not guardian_client.contract:
        raise HTTPException(status_code=503, detail="Guardian contract is not configured")

    try:
        state = guardian_client.get_guardian_state(wallet_address)
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(error)) from error

    return state or {}


@app.post("/trigger")
@app.post("/trigger-attack")
@app.post("/api/demo/trigger")
def trigger_demo_event(payload: DemoTriggerRequest) -> dict[str, Any]:
    logger.info(
        "Trigger attack request received baseline=%s event=%s",
        payload.baseline_reserves,
        payload.event_reserves,
    )

    if monitor_service is None:
        raise HTTPException(
            status_code=503,
            detail=monitor_error or "Monitor service is not configured",
        )

    if not reactive_guardian_client.is_ready():
        raise HTTPException(
            status_code=503,
            detail="Reactive guardian contract is not ready for writes",
        )

    reactive_state = reactive_guardian_client.status() or {}
    current_reserves = reactive_state.get("last_observed_reserves", {}) or {}
    current_reserve0 = int(current_reserves.get("reserve0", 1_000_000))
    current_reserve1 = int(current_reserves.get("reserve1", 1_000_000))
    baseline_reserve0 = int(payload.baseline_reserves.get("reserve0", current_reserve0))
    baseline_reserve1 = int(payload.baseline_reserves.get("reserve1", current_reserve1))
    abnormal_reserve0 = int(
        payload.event_reserves.get("reserve0", max(int(baseline_reserve0 * 0.62), 1))
    )
    abnormal_reserve1 = int(
        payload.event_reserves.get("reserve1", max(int(baseline_reserve1 * 0.49), 1))
    )
    processed_events_before = _monitor_processed_events()

    monitor_service.start()
    time.sleep(0.5)

    pair_address = str(
        reactive_state.get("pair_address") or settings.deployment_manifest.get("demoPairAddress") or ""
    )
    source_chain_id = int(
        reactive_state.get("source_chain_id") or settings.deployment_manifest.get("sourceChainId") or 0
    )

    logger.info(
        "Trigger attack reserves current=(%s,%s) baseline=(%s,%s) abnormal=(%s,%s)",
        current_reserve0,
        current_reserve1,
        baseline_reserve0,
        baseline_reserve1,
        abnormal_reserve0,
        abnormal_reserve1,
    )

    baseline_tx_hash = None
    should_prime_baseline = (
        not reactive_state.get("baseline_initialized")
        or current_reserve0 != baseline_reserve0
        or current_reserve1 != baseline_reserve1
    )
    if should_prime_baseline:
        baseline_tx_hash = reactive_guardian_client.react(
            reserve0=baseline_reserve0,
            reserve1=baseline_reserve1,
            block_number=reactive_guardian_client.w3.eth.block_number,
            pair_address=pair_address,
            source_chain_id=source_chain_id,
        )

    abnormal_tx_hash = reactive_guardian_client.react(
        reserve0=abnormal_reserve0,
        reserve1=abnormal_reserve1,
        block_number=reactive_guardian_client.w3.eth.block_number,
        pair_address=pair_address,
        source_chain_id=source_chain_id,
    )

    analyzed_event = _wait_for_monitored_event(
        abnormal_tx_hash,
        processed_events_before,
    )
    system_state = _system_state(pair_address or None)
    latest_ai_result = system_state.get("ai", {}).get("latest_result")
    system_latest_event = system_state.get("latest_event")
    latest_event = analyzed_event
    if (
        latest_event is None
        and isinstance(system_latest_event, dict)
        and str(system_latest_event.get("transaction_hash", "")).lower() == abnormal_tx_hash.lower()
    ):
        latest_event = system_latest_event
    event_detected = latest_event is not None
    executions = (
        latest_event.get("executions", {})
        if isinstance(latest_event, dict)
        else (latest_ai_result.get("executions", {}) if isinstance(latest_ai_result, dict) else {})
    )
    risk_score = (
        int(round(float(latest_event.get("anomaly", {}).get("risk_score", 0.0)) * 100))
        if isinstance(latest_event, dict)
        else system_state.get("ai", {}).get("latest_risk_score")
    )
    decision = (
        str(latest_event.get("decision", {}).get("action", "")).upper() or None
        if isinstance(latest_event, dict)
        else (
            str(latest_ai_result.get("decision", {}).get("action", "")).upper() or None
            if isinstance(latest_ai_result, dict)
            else None
        )
    )

    response_payload = {
        "status": "completed" if event_detected else "submitted",
        "pair_address": pair_address,
        "baseline_transaction_hash": baseline_tx_hash,
        "abnormal_transaction_hash": abnormal_tx_hash,
        "event_detected": event_detected,
        "event_transaction_hash": latest_event.get("transaction_hash") if isinstance(latest_event, dict) else abnormal_tx_hash,
        "risk_score": risk_score,
        "decision": decision,
        "execution_transaction_hash": _execution_transaction_hash(executions, "") or None,
        "executions": executions,
        "logs": _demo_logs(latest_event if isinstance(latest_event, dict) else None, abnormal_tx_hash),
        "latest_event": latest_event,
        "system_state": system_state,
        "monitor_running": monitor_service.is_running(),
    }

    logger.info(
        "Trigger attack response status=%s event_detected=%s abnormal_tx=%s execution_tx=%s",
        response_payload["status"],
        response_payload["event_detected"],
        abnormal_tx_hash,
        response_payload["execution_transaction_hash"],
    )

    return response_payload


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.app:app", host="0.0.0.0", port=settings.port, reload=settings.debug)
