# Aegis AI Guardian

Aegis AI Guardian is a modular full-stack Web3 starter project that combines:

- A Solidity smart contract for on-chain guardian state storage
- A Python AI module for wallet risk assessment
- A Flask backend that uses Web3.py to interact with the contract
- A basic Hardhat setup for local development and deployment

## Project Structure

```text
Aegis AI Guardian/
|-- contracts/
|   `-- AegisAIGuardian.sol
|-- ai/
|   |-- __init__.py
|   |-- guardian_engine.py
|   `-- risk_rules.py
|-- backend/
|   |-- __init__.py
|   |-- app.py
|   |-- blockchain.py
|   `-- config.py
|-- scripts/
|   |-- deploy.js
|   `-- run_guardian.py
|-- .env.example
|-- .gitignore
|-- hardhat.config.js
|-- package.json
|-- README.md
`-- requirements.txt
```

## Features

- `AegisAIGuardian.sol` stores the most recent AI guardian assessment for each wallet
- `GuardianEngine` produces modular risk assessments from wallet activity signals
- `GuardianContractClient` uses Web3.py to read and write on-chain guardian state
- `Flask` API exposes a simple endpoint for AI assessment and optional on-chain recording

## Getting Started

### 1. Install Node.js dependencies

```bash
npm install
```

### 2. Install Python dependencies

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and update the values for your network and wallet.

### 4. Compile and deploy the contract

Start a local Hardhat node:

```bash
npm run node
```

In a new terminal, deploy:

```bash
npm run deploy:local
```

### 5. Run the backend

```bash
python -m backend.app
```

### 6. Call the API

Example request:

```bash
curl -X POST http://127.0.0.1:5000/api/assess \
  -H "Content-Type: application/json" \
  -d "{\"wallet_address\":\"0x000000000000000000000000000000000000dEaD\",\"transaction_value_eth\":12.5,\"failed_transactions_last_hour\":6,\"unique_counterparties_last_day\":8,\"contract_interactions_last_day\":14,\"flagged_by_siem\":false,\"record_onchain\":false}"
```

## Running the AI Module Standalone

```bash
python scripts/run_guardian.py --wallet 0x000000000000000000000000000000000000dEaD --value 25 --failed 3 --counterparties 18 --contracts 10
```

## Notes

- The backend can operate without a deployed contract, but on-chain recording requires `AEGIS_CONTRACT_ADDRESS` and `GUARDIAN_SIGNER_KEY`
- `backend/blockchain.py` will use the compiled Hardhat artifact ABI when available and otherwise falls back to a built-in ABI
- This scaffold is intended as a clean starting point for expanding the AI logic, access control, and monitoring pipeline
