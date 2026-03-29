"use client";

import { motion } from "framer-motion";

import { MaterialIcon } from "@/components/ui/material-icon";
import { StatusPill } from "@/components/ui/status-pill";
import { deriveSecurityView } from "@/lib/system-state";
import { useUIStore } from "@/store/ui-store";

export function ThreatAlertBanner() {
  const systemState = useUIStore((state) => state.systemState);
  const latestEvent = useUIStore((state) => state.systemState?.latest_event);
  const securityView = deriveSecurityView(systemState);
  const headline =
    securityView.threatLabel === "ATTACK"
      ? `Attack state detected: ${securityView.decisionLabel} response in effect`
      : "System state is safe and the frontend is polling backend /status";
  const incidentId = latestEvent?.transaction_hash.slice(0, 18) ?? "PENDING-EVENT";
  const timestamp = latestEvent
    ? new Date(latestEvent.observed_at).toLocaleString("en-GB", { hour12: false })
    : "Polling every 3 seconds";

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden border-l-4 border-tertiary-container bg-surface-container-low p-6"
    >
      <div className="absolute right-0 top-0 p-4 opacity-10">
        <MaterialIcon icon="warning" className="text-9xl" />
      </div>

      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-tertiary-container animate-pulse-lite" />
            <span className="text-[10px] uppercase tracking-[0.24em] text-tertiary">
              Live Threat Signal
            </span>
          </div>
          <h1 className="font-headline text-3xl font-bold leading-none text-tertiary-container md:text-4xl">
            {headline}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-sm border border-outline-variant/20 bg-surface-container-highest px-4 py-2">
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
              State
            </p>
            <StatusPill label={securityView.threatLabel} tone={securityView.threatTone} />
          </div>
          <div className="rounded-sm border border-outline-variant/20 bg-surface-container-highest px-4 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
              Risk Score
            </p>
            <p className="font-mono text-sm font-semibold">{securityView.riskScore}%</p>
          </div>
          <div className="rounded-sm border border-outline-variant/20 bg-surface-container-highest px-4 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
              Protocol
            </p>
            <p className="font-mono text-sm font-semibold">{securityView.protocolStatus}</p>
          </div>
          <div className="rounded-sm border border-outline-variant/20 bg-surface-container-highest px-4 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
              Incident
            </p>
            <p className="font-mono text-sm font-semibold">{incidentId}</p>
          </div>
          <div className="rounded-sm border border-outline-variant/20 bg-surface-container-highest px-4 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
              Updated
            </p>
            <p className="font-mono text-sm font-semibold">{timestamp}</p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
