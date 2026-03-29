from __future__ import annotations

import logging
from typing import Any, Mapping

from ai import GuardianEngine
from backend.blockchain import retry_call
from backend.config import Settings, settings
from backend.event_listener import DeFiEventMonitor, configure_logging
from web3 import Web3


logger = logging.getLogger("aegis.monitor.realtime")


def _is_decoded_event(entry: Any) -> bool:
    if isinstance(entry, Mapping):
        return "args" in entry and "event" in entry
    return hasattr(entry, "args") and hasattr(entry, "event")


class RealTimeContractMonitor(DeFiEventMonitor):
    """
    Real-time event listener that uses Web3.py event filters.

    It reuses the existing AI + execution pipeline from DeFiEventMonitor and only
    changes the event ingestion path to `create_filter(...).get_new_entries()`.
    """

    def __init__(
        self,
        app_settings: Settings,
        guardian_engine: GuardianEngine | None = None,
        *,
        w3: Web3 | None = None,
    ) -> None:
        super().__init__(app_settings, guardian_engine=guardian_engine, w3=w3)
        self._event_filter: Any | None = None
        self._fallback_to_log_polling = False

    def run_forever(self) -> None:
        logger.info(
            "[monitor] realtime filter listener starting event=%s contract=%s",
            self.settings.monitor_event_name,
            self.monitor_contract.address,
        )

        while not self._stop_event.is_set():
            try:
                processed = self.poll_filter_once()
                if processed:
                    logger.info("[monitor] processed %s realtime event(s)", processed)
            except Exception as error:  # noqa: BLE001
                self._remember_error(str(error))
                logger.exception("[monitor] realtime filter loop failure: %s", error)
                self._event_filter = None

            self._stop_event.wait(self.settings.monitor_poll_interval_seconds)

    def poll_filter_once(self) -> int:
        if self._fallback_to_log_polling:
            processed = super().poll_once()
            if processed:
                logger.info("[monitor] processed %s event(s) via eth_getLogs fallback", processed)
            return processed

        event_filter = self._ensure_event_filter()
        try:
            entries = retry_call(
                lambda: event_filter.get_new_entries(),
                "poll monitor filter entries",
                self.retry_config,
            )
        except Exception as error:  # noqa: BLE001
            logger.warning(
                "[monitor] Web3 filter polling unavailable (%s). Falling back to eth_getLogs polling.",
                error,
            )
            self._event_filter = None
            self._fallback_to_log_polling = True
            return super().poll_once()

        processed = 0
        highest_block = None

        for entry in entries:
            decoded_event = entry if _is_decoded_event(entry) else self.monitor_event.process_log(entry)
            self._handle_event(decoded_event)
            processed += 1

            block_number = decoded_event.get("blockNumber")
            if isinstance(block_number, int):
                highest_block = block_number if highest_block is None else max(highest_block, block_number)

        if highest_block is not None:
            with self._lock:
                self._next_block = highest_block + 1
        elif self._next_block is None:
            latest_block = retry_call(
                lambda: self.w3.eth.block_number,
                "read latest block number for filter listener",
                self.retry_config,
            )
            with self._lock:
                self._next_block = latest_block + 1

        return processed

    def _ensure_event_filter(self) -> Any:
        if self._event_filter is not None:
            return self._event_filter

        from_block: int | str
        if self.settings.monitor_start_block is not None:
            from_block = self.settings.monitor_start_block
        else:
            from_block = "latest"

        logger.info(
            "[monitor] creating Web3.py filter event=%s contract=%s from_block=%s",
            self.settings.monitor_event_name,
            self.monitor_contract.address,
            from_block,
        )
        self._event_filter = self.monitor_event.create_filter(from_block=from_block)

        if isinstance(from_block, int):
            with self._lock:
                self._next_block = from_block

        return self._event_filter


def main() -> None:
    configure_logging(settings.monitor_log_level)
    monitor = RealTimeContractMonitor(settings)
    monitor.run_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("[monitor] realtime listener stopped by user")
