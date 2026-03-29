"use client";

import { useAsyncButtonAction } from "@/hooks/use-async-button-action";
import {
  executeEmergencyPause,
  loadRuntimeSnapshot,
} from "@/lib/button-actions";
import { useUIStore } from "@/store/ui-store";
import { shortenAddress } from "@/lib/utils";

export function AppFooter() {
  const setSystemState = useUIStore((state) => state.setSystemState);
  const globalKillswitchAction = useAsyncButtonAction({
    label: "Global Killswitch",
    action: async () => {
      const result = await executeEmergencyPause();
      setSystemState(result.snapshot.systemState);
      return result;
    },
    getSuccessMessage: (result) => `Pause tx ${shortenAddress(result.transaction.hash)} submitted`,
  });
  const diagnosticLogAction = useAsyncButtonAction({
    label: "Diagnostic Log",
    action: async () => {
      const result = await loadRuntimeSnapshot();
      setSystemState(result.systemState);
      console.info("[diagnostic-log] snapshot", result);
      return result;
    },
    getSuccessMessage: (result) =>
      result.systemState.backend.web3_connected ? "Diagnostics ready" : "Backend offline",
  });
  const networkStatusAction = useAsyncButtonAction({
    label: "Network Status",
    action: async () => {
      const result = await loadRuntimeSnapshot();
      setSystemState(result.systemState);
      return result;
    },
    getSuccessMessage: (result) =>
      result.systemState.deployment.network
        ? `${result.systemState.deployment.network.toUpperCase()} online`
        : "Network state updated",
  });
  const killswitchLabel = globalKillswitchAction.isLoading
    ? "Pausing..."
    : globalKillswitchAction.isError
      ? "Killswitch Error"
      : globalKillswitchAction.isSuccess
        ? "Pause Submitted"
        : "Global Killswitch";
  const diagnosticsLabel = diagnosticLogAction.isLoading
    ? "Loading..."
    : diagnosticLogAction.isError
      ? "Log Error"
      : diagnosticLogAction.isSuccess
        ? "Diagnostics Ready"
        : "Diagnostic Log";
  const networkLabel = networkStatusAction.isLoading
    ? "Syncing..."
    : networkStatusAction.isError
      ? "Status Error"
      : networkStatusAction.isSuccess
        ? "Network Synced"
        : "Network Status";

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 flex h-10 items-center justify-between bg-surface-container px-4 shadow-footer md:px-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#F9362C]">
        Protocol Pause | Emergency Mode | System Stable
      </p>

      <div className="hidden items-center gap-6 md:flex">
        <button
          type="button"
          onClick={() => void globalKillswitchAction.run()}
          disabled={globalKillswitchAction.isLoading}
          title={
            globalKillswitchAction.error ??
            globalKillswitchAction.feedback ??
            "Pause the protocol through the risk controller contract"
          }
          className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500 transition-colors hover:bg-[#F9362C] hover:text-white"
        >
          {killswitchLabel}
        </button>
        <button
          type="button"
          onClick={() => void diagnosticLogAction.run()}
          disabled={diagnosticLogAction.isLoading}
          title={
            diagnosticLogAction.error ??
            diagnosticLogAction.feedback ??
            "Fetch backend diagnostics and print them to the console"
          }
          className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500 transition-colors hover:bg-[#F9362C] hover:text-white"
        >
          {diagnosticsLabel}
        </button>
        <button
          type="button"
          onClick={() => void networkStatusAction.run()}
          disabled={networkStatusAction.isLoading}
          title={
            networkStatusAction.error ??
            networkStatusAction.feedback ??
            "Refresh the current network and protocol state"
          }
          className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#F9362C] transition-colors hover:bg-[#F9362C] hover:text-white"
        >
          {networkLabel}
        </button>
      </div>
    </footer>
  );
}
