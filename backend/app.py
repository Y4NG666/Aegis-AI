from __future__ import annotations

from flask import Flask, jsonify, request

from ai import GuardianEngine
from backend.blockchain import GuardianContractClient
from backend.config import settings


app = Flask(__name__)
engine = GuardianEngine()
contract_client = GuardianContractClient(
    provider_uri=settings.web3_provider_uri,
    contract_address=settings.contract_address,
    signer_key=settings.guardian_signer_key,
)


@app.get("/health")
def health() -> tuple[dict, int]:
    return {"status": "ok", "web3_connected": contract_client.w3.is_connected()}, 200


@app.post("/api/assess")
def assess_wallet() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}

    if "wallet_address" not in payload:
        return {"error": "wallet_address is required"}, 400

    result = engine.evaluate(payload)
    tx_hash = None

    if payload.get("record_onchain") and contract_client.is_ready():
        assessment = result["assessment"]
        tx_hash = contract_client.record_assessment(
            wallet_address=result["wallet_address"],
            risk_score=assessment["risk_score"],
            summary=result["summary"],
            active_guardian=assessment["active_guardian"],
        )

    response = {**result, "transaction_hash": tx_hash}
    return jsonify(response), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=settings.port, debug=True)
