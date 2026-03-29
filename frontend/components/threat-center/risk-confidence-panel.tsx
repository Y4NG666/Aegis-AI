"use client";

import { motion } from "framer-motion";

import { MaterialIcon } from "@/components/ui/material-icon";
import { StatusPill } from "@/components/ui/status-pill";
import { deriveSecurityView } from "@/lib/system-state";
import { useUIStore } from "@/store/ui-store";

const circumference = 2 * Math.PI * 88;

export function RiskConfidencePanel() {
  const systemState = useUIStore((state) => state.systemState);
  const securityView = deriveSecurityView(systemState);
  const progress = securityView.riskScore;
  const dashOffset = circumference - (progress / 100) * circumference;
  const decisionLabel = securityView.decisionLabel;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="relative overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container p-8 text-center"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-tertiary/5 to-transparent" />

      <div className="relative z-10 flex flex-col items-center">
        <p className="mb-6 text-xs uppercase tracking-[0.24em] text-on-surface-variant">
          Real-Time Risk Score
        </p>

        <div className="relative mb-6 flex h-48 w-48 items-center justify-center">
          <svg className="h-full w-full -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="88"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="8"
              className="text-surface-container-highest"
            />
            <circle
              cx="96"
              cy="96"
              r="88"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="text-tertiary transition-all duration-700"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-headline text-5xl font-bold text-on-surface">{progress}%</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-tertiary">
              Attack Probability
            </span>
          </div>
        </div>

        <div className="flex w-full items-center justify-center gap-2 rounded-full border border-tertiary/20 bg-tertiary/10 px-6 py-3 animate-strobe">
          <MaterialIcon icon="gavel" className="text-sm text-tertiary" />
          <span className="font-headline text-xs font-bold uppercase tracking-tight text-tertiary">
            Decision: {decisionLabel}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <StatusPill label={securityView.threatLabel} tone={securityView.threatTone} />
          <StatusPill
            label={securityView.protocolStatus}
            tone={securityView.protocolStatus === "PAUSED" ? "danger" : "primary"}
          />
        </div>
      </div>
    </motion.section>
  );
}
