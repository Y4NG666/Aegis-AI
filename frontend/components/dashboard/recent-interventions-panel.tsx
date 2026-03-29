"use client";

import { motion } from "framer-motion";

import { MaterialIcon } from "@/components/ui/material-icon";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";

export function RecentInterventionsPanel() {
  const systemState = useUIStore((state) => state.systemState);
  const interventions =
    systemState?.monitor.recent_events
      .filter((event) => Object.keys(event.executions).length > 0)
      .map((event) => ({
        age: new Date(event.observed_at).toLocaleTimeString("en-GB", { hour12: false }),
        title: `${event.decision.action.toUpperCase()} executed for ${event.subject_address}`,
        detail:
          event.decision.reasons[0] ??
          `Contract writes: ${Object.keys(event.executions).join(", ") || "none"}.`,
        tone: event.decision.action === "pause" ? ("primary" as const) : ("muted" as const),
      })) ?? [];

  return (
    <motion.section
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4 }}
      className="border border-outline-variant/10 bg-surface-container-highest/30 p-8"
    >
      <h3 className="mb-6 flex items-center gap-2 font-headline text-lg font-bold">
        <MaterialIcon icon="gavel" className="text-primary" />
        Recent Interventions
      </h3>

      <div className="space-y-6">
        {(interventions.length > 0
          ? interventions
          : [
              {
                age: "LIVE",
                title: "No automated interventions recorded yet",
                detail: "Simulate an attack to produce a contract event and AI response.",
                tone: "muted" as const,
              },
            ]).map((intervention) => (
          <div
            key={intervention.title}
            className={cn(
              "flex items-start gap-4 border-l pl-4",
              intervention.tone === "muted" ? "border-on-surface-variant/30" : "border-primary/30",
            )}
          >
            <div className="mt-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                {intervention.age}
              </span>
            </div>
            <div>
              <h4 className="font-headline text-sm font-bold">{intervention.title}</h4>
              <p className="mt-1 text-xs text-on-surface-variant">{intervention.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.24em] text-on-surface-variant">
        Showing the latest executions emitted by the backend event monitor.
      </p>
    </motion.section>
  );
}
