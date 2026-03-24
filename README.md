# Aegis AI Guardian

Aegis AI Guardian connects AI risk detection to on-chain automated defense:

- `ai/anomaly_detection.py` produces anomaly scores from transaction and liquidity signals
- `backend/event_listener.py` listens to blockchain events with Web3.py
- `backend/pipeline.py` turns AI output into a defense decision
- `backend/blockchain.py` signs and submits transactions to the smart contracts
- `RiskController.sol` executes the defensive action on-chain

## Project Structure

```text
Aegis AI Guardian/
|-- ai/
|   |-- anomaly_detection.py
|   |-- guardian_engine.py
|   |-- risk_rules.py
|   `-- strategy_engine.py
|-- backend/
|   |-- app.py
|   |-- blockchain.py
|   |-- config.py
|   |-- event_listener.py
|   `-- pipeline.py
|-- contracts/
|   |-- AegisAIGuardian.sol
|   |-- AegisReactiveLiquidityGuardian.sol
|   `-- RiskController.sol
|-- deployments/
|   `-- localhost.json
|-- scripts/
|   |-- check_demo_state.js
|   |-- deploy.js
|   |-- monitor.py
|   |-- run_guardian.py
|   `-- trigger_demo_event.js
|-- .env.example
|-- hardhat.config.js
|-- package.json
`-- requirements.txt
```

## What Works

- Wallet risk assessment is still available through the Flask API
- Event-driven anomaly scoring is available through the backend listener
- The backend can record AI state into `AegisAIGuardian`
- The backend can call `RiskController.pauseProtocol()` or `RiskController.adjustParameters()`
- Local deployments automatically write `deployments/localhost.json`
- The backend auto-loads contract addresses from that deployment file when env vars are not set
- Local demo mode falls back to Hardhat account `#0` if no signer key is configured

## Local Setup

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

Copy `.env.example` to `.env`.

For the local Hardhat demo, the important values are:

- `WEB3_PROVIDER_URI=http://127.0.0.1:8545`
- `AEGIS_DEPLOYMENT_FILE=deployments/localhost.json`
- `AUTO_START_MONITOR=true` if you want the Flask app to start the listener automatically

You can leave the contract addresses empty for the local demo because they are loaded from `deployments/localhost.json` after deployment.

## End-to-End Demo

### 1. Start the local chain

```bash
npm run node
```

### 2. Deploy the full stack

```bash
npm run deploy:local
```

This deploys:

- `AegisAIGuardian`
- `RiskController`
- `AegisReactiveLiquidityGuardian`

It also writes `deployments/localhost.json`.

### 3. Start the backend listener

Option A: run the event listener directly

```bash
python -m backend.event_listener
```

Option B: run the Flask API and let it auto-start the listener

```bash
python -m backend.app
```

If you use option B, set `AUTO_START_MONITOR=true` first.

### 4. Trigger an abnormal liquidity event

```bash
npm run demo:trigger
```

The trigger script sends two `react()` calls to `AegisReactiveLiquidityGuardian`:

- the first initializes the liquidity baseline
- the second emits `AbnormalLiquidityDetected`

### 5. Verify the pipeline result

Check the on-chain state:

```bash
npm run demo:check
```

Or query the backend:

```bash
curl http://127.0.0.1:5000/api/monitor/status
curl http://127.0.0.1:5000/api/risk-controller/status
curl http://127.0.0.1:5000/api/guardian/<demoPairAddress>
```

Expected demo outcome:

- the listener sees `AbnormalLiquidityDetected`
- the AI module outputs an anomaly score
- `StrategyEngine` chooses a defense action
- the backend records the assessment in `AegisAIGuardian`
- the backend calls `RiskController.pauseProtocol()` or `adjustParameters()`

## API Endpoints

### `GET /health`

Returns API, contract, and monitor status.

### `POST /api/assess`

Wallet risk scoring endpoint using `GuardianEngine`.

Example:

```bash
curl -X POST http://127.0.0.1:5000/api/assess \
  -H "Content-Type: application/json" \
  -d "{\"wallet_address\":\"0x000000000000000000000000000000000000dEaD\",\"transaction_value_eth\":12.5,\"failed_transactions_last_hour\":6,\"unique_counterparties_last_day\":8,\"contract_interactions_last_day\":14,\"flagged_by_siem\":false,\"record_onchain\":false}"
```

### `POST /api/anomaly/detect`

Direct anomaly-detection and defense-decision endpoint.

Example:

```bash
curl -X POST http://127.0.0.1:5000/api/anomaly/detect \
  -H "Content-Type: application/json" \
  -d "{\"subject_address\":\"0x000000000000000000000000000000000000dEaD\",\"transaction_data\":{\"tx_value_usd\":850000,\"slippage_bps\":2500,\"gas_spike_ratio\":4.2,\"failed_tx_count_1h\":7,\"unique_protocols_1h\":9,\"flash_loan_detected\":true},\"liquidity_changes\":{\"liquidity_before_usd\":2000000,\"liquidity_after_usd\":900000,\"reserve0_change_pct\":38,\"reserve1_change_pct\":51},\"on_chain_data\":{\"liquidity_drop_pct\":51,\"volatility_index\":1.0},\"record_onchain\":false,\"execute_onchain\":false}"
```

### `GET /api/monitor/status`

Returns listener status and the most recent processed events.

### `GET /api/risk-controller/status`

Returns `paused` and current defense parameters.

### `GET /api/guardian/<wallet_address>`

Returns the last AI state stored for a wallet or monitored subject.
