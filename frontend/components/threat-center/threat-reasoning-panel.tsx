"use client";

import { motion } from "framer-motion";

import { MaterialIcon } from "@/components/ui/material-icon";
import { reasoningChecks } from "@/lib/mock-data";

export function ThreatReasoningPanel() {
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
            The AI identified a <span className="font-medium text-primary">high-velocity sequence</span> of
            flash loan utilization followed by immediate liquidity pool depth manipulation. The caller
            address has no prior transaction history, suggesting a{" "}
            <span className="font-medium text-on-surface underline decoration-tertiary/50">
              disposable exploit contract
            </span>
            .
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
          className="flex items-center justify-center gap-2 rounded bg-primary py-4 font-headline text-xs font-bold uppercase tracking-[0.22em] text-on-primary hover:shadow-glow active:scale-95"
        >
          <MaterialIcon icon="search_insights" className="text-sm" />
          Investigate Further
        </button>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded bg-surface-container-highest py-3 font-headline text-xs font-bold uppercase tracking-tight text-on-surface hover:bg-surface-bright active:scale-95"
          >
            <MaterialIcon icon="block" className="text-sm" />
            Dismiss False Positive
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded bg-surface-container-highest py-3 font-headline text-xs font-bold uppercase tracking-tight text-on-surface hover:bg-surface-bright active:scale-95"
          >
            <MaterialIcon icon="warning" className="text-sm" />
            Manual Override
          </button>
        </div>
      </div>
    </motion.section>
  );
}
