"use client";

import { motion } from "framer-motion";

import { MaterialIcon } from "@/components/ui/material-icon";
import { interventions } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function RecentInterventionsPanel() {
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
        {interventions.map((intervention) => (
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

      <button
        type="button"
        className="mt-8 font-headline text-xs font-bold uppercase tracking-[0.24em] text-primary hover:underline"
      >
        View Full History
      </button>
    </motion.section>
  );
}
