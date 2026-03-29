"use client";

import { useState } from "react";

import { motion } from "framer-motion";

import { MaterialIcon } from "@/components/ui/material-icon";
import { useAsyncButtonAction } from "@/hooks/use-async-button-action";
import { loadRuntimeSnapshot } from "@/lib/button-actions";
import { useUIStore } from "@/store/ui-store";

export function ThreatReasoningPanel() {
  const latestEvent = useUIStore((state) => state.systemState?.latest_event);
  const systemState = useUIStore((state) => state.systemState);
  const actionPending = useUIStore((state) => state.actionPending);
  const actionError = useUIStore((state) => state.actionError);
  const lastDemoTrigger = useUIStore((state) => state.lastDemoTrigger);
  const startMonitor = useUIStore((state) => state.startMonitor);
  const triggerDemoEvent = useUIStore((state) => state.triggerDemoEvent);
  const setSystemState = useUIStore((state) => state.setSystemState);
  const [pendingAction, setPendingAction] = useState<"simulate" | "listener" | null>(null);
  const reasoningChecks = latestEvent?.anomaly.reasons.length
    ? latestEvent.anomaly.reasons
    : ["Listener ready", "Awaiting first anomaly event"];
  const refreshStreamAction = useAsyncButtonAction({
    label: "Refresh Stream",
    action: async () => {
      const result = await loadRuntimeSnapshot();
      setSystemState(result.systemState);
      return result;
    },
    getSuccessMessage: (result) =>
      result.systemState.monitor.running ? "Live stream active" : "Listener still idle",
  });

  async function handleSimulateAttack() {
    console.log("[threat-reasoning] simulate attack button clicked");
    setPendingAction("simulate");

    try {
      console.log("[threat-reasoning] sending POST http://localhost:8000/trigger-attack");
      const response = await triggerDemoEvent();
      console.log("[threat-reasoning] simulate attack response", response);
      console.info("[threat-reasoning] simulate attack completed");
    } catch (error) {
      console.error("[threat-reasoning] simulate attack failed", error);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleStartMonitor() {
    console.info("[threat-reasoning] start listener requested");
    setPendingAction("listener");

    try {
      await startMonitor();
      console.info("[threat-reasoning] listener started");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24 }}
      className="space-y-6"
    >
      <div className="glass-panel rounded-lg border border-outline-variant/10 p-6">
        <h3 className="flex items-center gap-2 font-headline text-sm font-semibold uppercase tracking-tight">
          <MaterialIcon icon="psychology" className="text-lg text-primary" />
          Threat Reasoning
        </h3>

        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-on-surface-variant">
            {latestEvent
              ? `The backend listener decoded an abnormal liquidity event and the AI scored it at ${Math.round(
                  latestEvent.anomaly.risk_score * 100,
                )}%. The primary reasoning path is "${latestEvent.decision.reasons[0] ?? "No explicit decision reason"}".`
              : "The reasoning engine is connected to the backend stream. Once a monitored contract event is emitted, AI feature scores and execution reasons will appear here in real time."}
          </p>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {reasoningChecks.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded bg-surface-container-highest/50 p-2"
              >
                <MaterialIcon icon="check_circle" className="text-xs text-primary" />
                <span className="font-mono text-[10px] uppercase">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void handleSimulateAttack()}
          disabled={actionPending}
          className="flex items-center justify-center gap-2 rounded bg-primary py-4 font-headline text-xs font-bold uppercase tracking-[0.22em] text-on-primary hover:shadow-glow active:scale-95"
        >
          <MaterialIcon icon="search_insights" className="text-sm" />
          {pendingAction === "simulate" && actionPending ? "Simulating..." : "Simulate Attack"}
        </button>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => void handleStartMonitor()}
            disabled={actionPending}
            className="flex items-center justify-center gap-2 rounded bg-surface-container-highest py-3 font-headline text-xs font-bold uppercase tracking-tight text-on-surface hover:bg-surface-bright active:scale-95"
          >
            <MaterialIcon icon="sensors" className="text-sm" />
            {pendingAction === "listener" && actionPending ? "Starting..." : "Start Listener"}
          </button>
          <button
            type="button"
            onClick={() => void refreshStreamAction.run()}
            disabled={refreshStreamAction.isLoading}
            title={
              refreshStreamAction.error ??
              refreshStreamAction.feedback ??
              "Refresh backend stream and monitor state"
            }
            className="flex items-center justify-center gap-2 rounded bg-surface-container-highest py-3 font-headline text-xs font-bold uppercase tracking-tight text-on-surface hover:bg-surface-bright active:scale-95"
          >
            <MaterialIcon
              icon={systemState?.monitor.running ? "wifi_tethering" : "sync"}
              className="text-sm"
            />
            {refreshStreamAction.isLoading
              ? "Refreshing..."
              : systemState?.monitor.running
                ? "Live Stream Active"
                : "Refresh Stream"}
          </button>
        </div>

        {lastDemoTrigger ? (
          <div className="rounded bg-surface-container-highest/70 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
              Latest execution
            </p>
            <p className="mt-2 text-sm text-on-surface">
              {lastDemoTrigger.decision ?? "PENDING"} at{" "}
              {lastDemoTrigger.risk_score !== null ? `${lastDemoTrigger.risk_score}%` : "--"} risk
            </p>
            <p className="mt-2 break-all font-mono text-xs text-primary">
              {lastDemoTrigger.execution_transaction_hash ??
                lastDemoTrigger.abnormal_transaction_hash}
            </p>
          </div>
        ) : null}

        {actionError ? (
          <div className="rounded bg-tertiary/10 p-3 text-xs text-tertiary">{actionError}</div>
        ) : null}
      </div>
    </motion.section>
  );
}
