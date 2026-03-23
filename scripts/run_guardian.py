from __future__ import annotations

import argparse
import json

from ai import GuardianEngine


def main() -> None:
    parser = argparse.ArgumentParser(description="Run an Aegis AI Guardian assessment.")
    parser.add_argument("--wallet", required=True, help="Wallet address to assess")
    parser.add_argument("--value", type=float, default=0, help="Transaction value in ETH")
    parser.add_argument("--failed", type=int, default=0, help="Failed transactions in the last hour")
    parser.add_argument("--counterparties", type=int, default=0, help="Unique counterparties in the last day")
    parser.add_argument("--contracts", type=int, default=0, help="Contract interactions in the last day")
    parser.add_argument("--flagged", action="store_true", help="Flag wallet based on external SIEM input")
    args = parser.parse_args()

    engine = GuardianEngine()
    result = engine.evaluate(
        {
            "wallet_address": args.wallet,
            "transaction_value_eth": args.value,
            "failed_transactions_last_hour": args.failed,
            "unique_counterparties_last_day": args.counterparties,
            "contract_interactions_last_day": args.contracts,
            "flagged_by_siem": args.flagged,
        }
    )

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
