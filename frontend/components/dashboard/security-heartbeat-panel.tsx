"use client";

import { motion } from "framer-motion";

import { MaterialIcon } from "@/components/ui/material-icon";
import { useUIStore } from "@/store/ui-store";

export function SecurityHeartbeatPanel() {
  const systemState = useUIStore((state) => state.systemState);
  const latestEvent = systemState?.latest_event;
  const dashboardStats = [
    {
      label: "MONITOR",
      value: systemState?.monitor.running ? "RUNNING" : "IDLE",
    },
    {
      label: "PROCESSED_EVENTS",
      value: String(systemState?.monitor.processed_events ?? 0),
    },
    {
      label: "LAST_RISK",
      value: latestEvent ? `${Math.round(latestEvent.anomaly.risk_score * 100)}%` : "N/A",
    },
    {
      label: "LAST_BLOCK",
      value: latestEvent ? String(latestEvent.block_number) : "N/A",
    },
  ] as const;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="security-heartbeat-bg overflow-hidden border border-outline-variant/10 bg-surface-container-low"
    >
      <div className="flex flex-col gap-4 border-b border-outline-variant/5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <MaterialIcon icon="analytics" className="text-primary" />
          <h3 className="font-headline text-sm font-semibold tracking-wide">SECURITY HEARTBEAT</h3>
        </div>

        <div className="flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.2em]">
          <span className="text-primary">
            Active Subject: {systemState?.contracts.guardian.subject_address || "UNSET"}
          </span>
          <span className="text-on-surface-variant">
            Next Block: {systemState?.monitor.next_block ?? "WAITING"}
          </span>
        </div>
      </div>

      <div className="flex min-h-[320px] items-center justify-center p-8 md:p-10">
        <svg className="h-48 w-full opacity-80" preserveAspectRatio="none" viewBox="0 0 800 200">
          <path
            d="M0 100 L100 100 L120 40 L140 160 L160 100 L300 100 L320 20 L340 180 L360 100 L500 100 L520 80 L540 120 L560 100 L800 100"
            fill="none"
            stroke="#f3ffca"
            strokeWidth="2"
            className="drop-shadow-[0_0_8px_rgba(243,255,202,0.5)]"
          />
          <circle cx="330" cy="100" r="4" fill="#f3ffca" className="animate-pulse-lite" />
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-4 bg-surface-container/30 p-4 md:grid-cols-4">
        {dashboardStats.map((stat) => (
          <div key={stat.label} className="space-y-1">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant">
              {stat.label}
            </p>
            <p className="font-mono text-xs text-on-surface">{stat.value}</p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
