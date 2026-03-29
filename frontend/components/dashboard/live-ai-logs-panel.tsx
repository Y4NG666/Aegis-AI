"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";

const toneClasses = {
  primary: "text-primary",
  muted: "text-on-surface-variant",
  danger: "text-tertiary",
};

export function LiveAiLogsPanel() {
  const systemState = useUIStore((state) => state.systemState);
  const lastDemoTrigger = useUIStore((state) => state.lastDemoTrigger);
  const recentEvents = systemState?.monitor.recent_events ?? [];
  const liveAiLogs =
    recentEvents.length > 0
      ? recentEvents.flatMap((event) => [
          {
            time: `[${new Date(event.observed_at).toLocaleTimeString("en-GB", { hour12: false })}]`,
            type: "EVENT",
            message: `Event detected for ${event.subject_address} at block ${event.block_number}.`,
            tone: "primary" as const,
          },
          {
            time: `[${new Date(event.observed_at).toLocaleTimeString("en-GB", { hour12: false })}]`,
            type: "AI",
            message: `Risk score ${Math.round(event.anomaly.risk_score * 100)}%.`,
            tone: event.anomaly.risk_score >= 0.7 ? ("danger" as const) : ("primary" as const),
          },
          {
            time: `[${new Date(event.observed_at).toLocaleTimeString("en-GB", { hour12: false })}]`,
            type: "AI",
            message: `Decision ${event.decision.action.toUpperCase()}.`,
            tone: event.decision.action === "pause" ? ("danger" as const) : ("primary" as const),
          },
          {
            time: `[${new Date(event.observed_at).toLocaleTimeString("en-GB", { hour12: false })}]`,
            type: "EXEC",
            message:
              Object.keys(event.executions).length > 0
                ? `Transaction hash ${
                    event.executions.pause ??
                    event.executions.hedge ??
                    event.executions.guardian ??
                    event.transaction_hash
                  }.`
                : `Transaction hash ${event.transaction_hash}.`,
            tone: Object.keys(event.executions).length > 0 ? ("primary" as const) : ("muted" as const),
          },
        ])
      : (lastDemoTrigger?.logs.length ?? 0) > 0
        ? lastDemoTrigger!.logs.map((log) => ({
            time: "[LIVE]",
            type: "DEMO",
            message: `${log.label}: ${log.value}`,
            tone:
              log.label === "Risk score" && (lastDemoTrigger?.risk_score ?? 0) >= 70
                ? ("danger" as const)
                : ("primary" as const),
          }))
      : [
          {
            time: "[--:--:--]",
            type: "IDLE",
            message: "Waiting for the first contract event from the monitor listener.",
            tone: "muted" as const,
          },
        ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.26 }}
      className="flex h-[400px] flex-col bg-surface-container"
    >
      <div className="flex items-center justify-between border-b border-outline-variant/10 p-4">
        <h3 className="font-headline text-xs font-semibold uppercase tracking-[0.24em]">
          Live AI Logs
        </h3>
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse-lite" />
      </div>

      <div className="scrollbar-none flex-1 space-y-3 overflow-y-auto p-4 font-mono text-[10px]">
        {liveAiLogs.map((log) => (
          <div key={`${log.time}-${log.message}`} className="flex gap-2">
            <span className="text-on-surface-variant">{log.time}</span>
            <span className={cn("font-semibold", toneClasses[log.tone])}>{log.type}:</span>
            <span className="text-on-surface/80">{log.message}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
