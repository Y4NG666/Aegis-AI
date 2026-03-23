from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Optional

from web3 import Web3


FALLBACK_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "getGuardianState",
        "outputs": [
            {
                "components": [
                    {"internalType": "bool", "name": "active", "type": "bool"},
                    {"internalType": "uint256", "name": "lastRiskScore", "type": "uint256"},
                    {"internalType": "uint256", "name": "lastUpdated", "type": "uint256"},
                    {"internalType": "string", "name": "latestSummary", "type": "string"},
                ],
                "internalType": "struct AegisAIGuardian.GuardianState",
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "account", "type": "address"},
            {"internalType": "uint256", "name": "riskScore", "type": "uint256"},
            {"internalType": "string", "name": "summary", "type": "string"},
            {"internalType": "bool", "name": "active", "type": "bool"},
        ],
        "name": "updateGuardianState",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


def _load_contract_abi() -> list[dict]:
    artifact_path = (
        Path(__file__).resolve().parents[1]
        / "artifacts"
        / "contracts"
        / "AegisAIGuardian.sol"
        / "AegisAIGuardian.json"
    )
    if artifact_path.exists():
        with artifact_path.open("r", encoding="utf-8") as artifact_file:
            return json.load(artifact_file)["abi"]
    return FALLBACK_ABI


class GuardianContractClient:
    def __init__(self, provider_uri: str, contract_address: str, signer_key: str = "") -> None:
        self.w3 = Web3(Web3.HTTPProvider(provider_uri))
        self.contract_address = contract_address
        self.signer_key = signer_key
        self.contract = None

        if contract_address:
            checksum_address = self.w3.to_checksum_address(contract_address)
            self.contract = self.w3.eth.contract(address=checksum_address, abi=_load_contract_abi())

    def is_ready(self) -> bool:
        return bool(self.contract) and self.w3.is_connected()

    def get_guardian_state(self, wallet_address: str) -> Optional[Dict[str, Any]]:
        if not self.contract:
            return None

        state = self.contract.functions.getGuardianState(
            self.w3.to_checksum_address(wallet_address)
        ).call()
        return {
            "active": state[0],
            "last_risk_score": state[1],
            "last_updated": state[2],
            "latest_summary": state[3],
        }

    def record_assessment(
        self,
        wallet_address: str,
        risk_score: int,
        summary: str,
        active_guardian: bool,
    ) -> str:
        if not self.contract:
            raise RuntimeError("Contract client is not configured")
        if not self.signer_key:
            raise RuntimeError("Missing guardian signer key")

        signer = self.w3.eth.account.from_key(self.signer_key)
        nonce = self.w3.eth.get_transaction_count(signer.address, "pending")

        tx = self.contract.functions.updateGuardianState(
            self.w3.to_checksum_address(wallet_address),
            risk_score,
            summary,
            active_guardian,
        ).build_transaction(
            {
                "from": signer.address,
                "nonce": nonce,
                "gas": 300000,
                "gasPrice": self.w3.eth.gas_price,
            }
        )

        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.signer_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        return tx_hash.hex()
