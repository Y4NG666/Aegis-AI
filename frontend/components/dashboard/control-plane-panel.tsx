"use client";

import { useState } from "react";

import { ConnectWalletButton } from "@/components/ui/connect-wallet-button";
import { DisconnectWalletButton } from "@/components/ui/disconnect-wallet-button";
import { MaterialIcon } from "@/components/ui/material-icon";
import { StatusPill } from "@/components/ui/status-pill";
import { deriveSecurityView } from "@/lib/system-state";
import { shortenAddress } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";

export function ControlPlanePanel() {
  const walletAddress = useUIStore((state) => state.walletAddress);
  const walletChainId = useUIStore((state) => state.walletChainId);
  const walletError = useUIStore((state) => state.walletError);
  const systemState = useUIStore((state) => state.systemState);
  const actionPending = useUIStore((state) => state.actionPending);
  const actionError = useUIStore((state) => state.actionError);
  const lastDemoTrigger = useUIStore((state) => state.lastDemoTrigger);
  const startMonitor = useUIStore((state) => state.startMonitor);
  const triggerDemoEvent = useUIStore((state) => state.triggerDemoEvent);
  const [pendingAction, setPendingAction] = useState<"listener" | "simulate" | null>(null);

  const latestEvent = systemState?.latest_event;
  const securityView = deriveSecurityView(systemState);
  const latestAction = securityView.decisionLabel;
  const monitorRunning = systemState?.monitor.running ?? false;
  const pairAddress =
    systemState?.contracts.reactive_guardian.status?.pair_address ??
    systemState?.deployment.demo_pair_address ??
    "";

  async function handleStartMonitor() {
    console.info("[control-plane] start listener requested");
    setPendingAction("listener");

    try {
      await startMonitor();
      console.info("[control-plane] listener started");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSimulateAttack() {
    console.log("[control-plane] simulate attack button clicked");
    setPendingAction("simulate");

    try {
      console.log("[control-plane] sending POST http://localhost:8000/trigger-attack");
      const response = await triggerDemoEvent();
      console.log("[control-plane] simulate attack response", response);
      console.info("[control-plane] simulate attack completed");
    } catch (error) {
      console.error("[control-plane] simulate attack failed", error);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <article className="space-y-6 rounded-lg border border-outline-variant/10 bg-surface-container-low p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary">
              Connected Control Plane
            </p>
            <h2 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
              Live Backend + Contract Bridge
            </h2>
            <p className="max-w-2xl text-sm text-on-surface-variant">
              Trigger the deployed monitor contract, let the backend listener process the emitted
              event, and watch the AI-driven defense state update in place after a simulated attack.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ConnectWalletButton />
            <DisconnectWalletButton />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-surface-container p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">
              Backend
            </p>
            <div className="mt-3 flex items-center gap-2">
              <StatusPill
                label={systemState?.backend.web3_connected ? "ONLINE" : "OFFLINE"}
                tone={systemState?.backend.web3_connected ? "primary" : "danger"}
              />
            </div>
          </div>

          <div className="rounded-lg bg-surface-container p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">
              Event Monitor
            </p>
            <div className="mt-3 flex items-center gap-2">
              <StatusPill label={monitorRunning ? "RUNNING" : "IDLE"} tone={monitorRunning ? "primary" : "warning"} />
            </div>
          </div>

          <div className="rounded-lg bg-surface-container p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">
              Threat Status
            </p>
            <div className="mt-3 flex items-center gap-2">
              <StatusPill label={securityView.threatLabel} tone={securityView.threatTone} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <button
            type="button"
            onClick={() => void handleStartMonitor()}
            disabled={actionPending}
            className="flex items-center justify-center gap-2 rounded bg-surface-container-highest px-5 py-3 font-headline text-xs font-bold uppercase tracking-[0.18em] text-on-surface hover:bg-surface-bright disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MaterialIcon icon="sensors" className="text-base" />
            {pendingAction === "listener" && actionPending ? "Starting..." : "Start Listener"}
          </button>
          <button
            type="button"
            onClick={() => void handleSimulateAttack()}
            disabled={actionPending}
            className="flex items-center justify-center gap-2 rounded bg-primary px-5 py-3 font-headline text-xs font-bold uppercase tracking-[0.18em] text-on-primary hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MaterialIcon icon="bolt" className="text-base" />
            {pendingAction === "simulate" && actionPending ? "Simulating..." : "Simulate Attack"}
          </button>
        </div>

        {actionError ? (
          <div className="rounded border border-tertiary/20 bg-tertiary/10 p-3 text-sm text-tertiary">
            {actionError}
          </div>
        ) : null}

        {lastDemoTrigger ? (
          <div className="space-y-4 rounded-lg border border-outline-variant/10 bg-surface-container p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">
                  Event
                </p>
                <p className="mt-2 text-sm text-on-surface">
                  {lastDemoTrigger.event_detected ? "Detected" : "Pending confirmation"}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">
                  Risk / Decision
                </p>
                <p className="mt-2 text-sm text-on-surface">
                  {lastDemoTrigger.risk_score !== null
                    ? `${lastDemoTrigger.risk_score}%`
                    : "--"}{" "}
                  / {lastDemoTrigger.decision ?? "PENDING"}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">
                  Execution Tx
                </p>
                <p className="mt-2 break-all font-mono text-xs text-primary">
                  {lastDemoTrigger.execution_transaction_hash ??
                    lastDemoTrigger.abnormal_transaction_hash}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">
                  Pair
                </p>
                <p className="mt-2 break-all font-mono text-xs text-on-surface">
                  {lastDemoTrigger.pair_address}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-surface-container-highest/60 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">
                Demo Output
              </p>
              <div className="mt-3 space-y-2">
                {lastDemoTrigger.logs.map((log) => (
                  <div key={`${log.label}-${log.value}`} className="flex flex-col gap-1 md:flex-row md:gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                      {log.label}
                    </span>
                    <span className="break-all font-mono text-xs text-on-surface">{log.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </article>

      <article className="space-y-4 rounded-lg border border-outline-variant/10 bg-surface-container p-6">
        <h3 className="flex items-center gap-2 font-headline text-lg font-bold">
          <MaterialIcon icon="hub" className="text-primary" />
          Runtime Snapshot
        </h3>

        <div className="space-y-3 text-sm text-on-surface-variant">
          <div className="flex items-center justify-between gap-4">
            <span>Connected wallet</span>
            <span className="font-mono text-on-surface">
              {walletAddress ? shortenAddress(walletAddress) : "Not connected"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Wallet chain</span>
            <span className="font-mono text-on-surface">
              {walletChainId ? `Chain ${walletChainId}` : "Unknown"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Risk score</span>
            <span className="font-mono text-on-surface">{securityView.riskScore}%</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Protocol status</span>
            <span className="font-mono text-on-surface">{securityView.protocolStatus}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Tracked pair</span>
            <span className="font-mono text-on-surface">
              {pairAddress ? shortenAddress(pairAddress) : "Unavailable"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Processed events</span>
            <span className="font-mono text-on-surface">
              {systemState?.monitor.processed_events ?? 0}
            </span>
          </div>
        </div>

        {walletError ? (
          <div className="rounded bg-surface-container-highest p-3 text-xs text-tertiary">
            {walletError}
          </div>
        ) : null}

        {latestEvent ? (
          <div className="rounded-lg bg-surface-container-highest/50 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">
              Latest Event
            </p>
            <p className="mt-2 text-sm text-on-surface">
              Block {latestEvent.block_number} routed to{" "}
              <span className="font-mono text-primary">{latestAction}</span> with{" "}
              <span className="font-mono">{securityView.riskScore}%</span> risk
            </p>
            <p className="mt-2 break-all font-mono text-xs text-on-surface-variant">
              {latestEvent.transaction_hash}
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-surface-container-highest/50 p-4 text-sm text-on-surface-variant">
            Waiting for the first on-chain event. Start the listener, then simulate an attack.
          </div>
        )}
      </article>
    </section>
  );
}
