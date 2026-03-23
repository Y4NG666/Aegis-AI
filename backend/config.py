from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


@dataclass
class Settings:
    web3_provider_uri: str = os.getenv("WEB3_PROVIDER_URI", "http://127.0.0.1:8545")
    contract_address: str = os.getenv("AEGIS_CONTRACT_ADDRESS", "")
    guardian_signer_key: str = os.getenv("GUARDIAN_SIGNER_KEY", "")
    port: int = int(os.getenv("PORT", "5000"))


settings = Settings()
