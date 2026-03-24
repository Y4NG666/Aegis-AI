"use client";

import { motion } from "framer-motion";

import { liveAiLogs } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const toneClasses = {
  primary: "text-primary",
  muted: "text-on-surface-variant",
  danger: "text-tertiary",
};

export function LiveAiLogsPanel() {
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
