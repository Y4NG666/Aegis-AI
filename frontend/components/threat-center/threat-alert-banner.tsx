"use client";

import { motion } from "framer-motion";

import { MaterialIcon } from "@/components/ui/material-icon";

export function ThreatAlertBanner() {
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
              Critical Security Event
            </span>
          </div>
          <h1 className="font-headline text-3xl font-bold leading-none text-tertiary-container md:text-4xl">
            Anomaly Detected: Possible Flash Loan Attack Pattern
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-sm border border-outline-variant/20 bg-surface-container-highest px-4 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
              Incident ID
            </p>
            <p className="font-mono text-sm font-semibold">TX-8821-ALPHA</p>
          </div>
          <div className="rounded-sm border border-outline-variant/20 bg-surface-container-highest px-4 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
              Timestamp
            </p>
            <p className="font-mono text-sm font-semibold">14:22:01.442 UTC</p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
