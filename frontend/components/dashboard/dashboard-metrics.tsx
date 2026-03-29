"use client";

import { motion } from "framer-motion";

import { MaterialIcon } from "@/components/ui/material-icon";
import { deriveSecurityView } from "@/lib/system-state";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";

const toneMap = {
  primary: {
    title: "text-primary",
    footer: "text-primary",
    dot: "bg-primary",
  },
  neutral: {
    title: "text-on-surface",
    footer: "text-on-surface-variant",
    dot: "bg-on-surface-variant",
  },
  danger: {
    title: "text-tertiary-container",
    footer: "text-tertiary",
    dot: "bg-tertiary",
  },
};

type LiveMetric = {
  label: string;
  value: string;
  description: string;
  tone: keyof typeof toneMap;
  icon: string;
  footer: string;
  progress?: number;
};

export function DashboardMetrics() {
  const walletAddress = useUIStore((state) => state.walletAddress);
  const systemState = useUIStore((state) => state.systemState);
  const securityView = deriveSecurityView(systemState);
  const metrics: LiveMetric[] = [
    {
      label: "SYSTEM_STATE",
      value: securityView.threatLabel,
      description: "Real-time security stance from backend /status polling",
      tone: securityView.threatTone,
      icon: "verified_user",
      footer: systemState?.monitor.running ? "LISTENER_ACTIVE" : "LISTENER_IDLE",
    },
    {
      label: "RISK_CONTROLLER",
      value: securityView.protocolStatus,
      description: "Current on-chain protocol protection mode",
      tone: securityView.protocolStatus === "PAUSED" ? "danger" : "neutral",
      icon: "shield_locked",
      footer: `${systemState?.monitor.processed_events ?? 0} EVENTS PROCESSED`,
      progress: securityView.riskScore,
    },
    {
      label: "RISK_SCORE",
      value: `${securityView.riskScore}%`,
      description:
        walletAddress ?? "Live risk score derived from the latest backend status snapshot",
      tone: walletAddress ? "primary" : "neutral",
      icon: "account_balance_wallet",
      footer: `LAST_ACTION_${securityView.decisionLabel}`,
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {metrics.map((metric, index) => {
        const tone = toneMap[metric.tone];
        const progress = metric.progress ?? 0;

        return (
          <motion.article
            key={metric.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className="group relative overflow-hidden bg-surface-container p-6 shadow-panel"
          >
            <div className="absolute right-3 top-2 opacity-10 transition-opacity group-hover:opacity-20">
              <MaterialIcon icon={metric.icon} className="text-6xl" />
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-on-surface-variant">
                {metric.label}
              </p>
              <h2 className={cn("mt-2 font-headline text-3xl font-bold", tone.title)}>
                {metric.value}
              </h2>
              <p className="mt-2 max-w-[18rem] text-sm text-on-surface-variant">
                {metric.description}
              </p>
            </div>

            {typeof metric.progress === "number" ? (
              <div className="mt-8 grid grid-cols-5 gap-1">
                {Array.from({ length: 5 }).map((_, itemIndex) => (
                  <div
                    key={`${metric.label}-${itemIndex}`}
                    className={cn(
                      "h-1",
                      itemIndex < progress / 20 ? "bg-primary" : "bg-surface-container-highest",
                    )}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-8 flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full animate-pulse-lite", tone.dot)} />
                <span className={cn("font-mono text-[11px]", tone.footer)}>{metric.footer}</span>
              </div>
            )}

            {typeof metric.progress === "number" ? (
              <div className="mt-4 flex items-center justify-between">
                <span className="font-mono text-[11px] text-on-surface-variant">{metric.footer}</span>
                <MaterialIcon icon="trending_flat" className="text-sm text-on-surface-variant" />
              </div>
            ) : null}
          </motion.article>
        );
      })}
    </section>
  );
}
