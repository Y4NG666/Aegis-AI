"use client";

import { motion } from "framer-motion";

import { MaterialIcon } from "@/components/ui/material-icon";
import { forensicRows } from "@/lib/mock-data";
import { useUIStore } from "@/store/ui-store";

export function ForensicQuickView() {
  const selectedForensicsId = useUIStore((state) => state.selectedForensicsId);
  const row = forensicRows.find((item) => item.id === selectedForensicsId) ?? forensicRows[0];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16 }}
      className="glass-panel mt-12 rounded-lg border border-outline-variant/10 p-6"
    >
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="font-headline text-xl font-bold uppercase tracking-tight">
            Forensic Quick-View: {row.id}
          </h3>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.24em] text-on-surface-variant">
            Status: Quarantine Protocol Active
          </p>
        </div>

        <button
          type="button"
          className="rounded-full p-2 transition-colors hover:bg-surface-container"
        >
          <MaterialIcon icon="close" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="col-span-2 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-sm bg-surface-container-lowest p-4">
              <label className="mb-1 block font-headline text-[9px] uppercase tracking-[0.2em] text-on-surface-variant">
                Timestamp
              </label>
              <div className="font-mono text-xs">2026-03-24 14:22:01.004 UTC</div>
            </div>
            <div className="rounded-sm bg-surface-container-lowest p-4">
              <label className="mb-1 block font-headline text-[9px] uppercase tracking-[0.2em] text-on-surface-variant">
                Gas Consumed
              </label>
              <div className="font-mono text-xs">2,142,000 WEI</div>
            </div>
          </div>

          <div className="rounded-sm bg-surface-container-lowest p-4">
            <label className="mb-1 block font-headline text-[9px] uppercase tracking-[0.2em] text-on-surface-variant">
              Raw Payload Analysis
            </label>
            <pre className="overflow-x-auto font-mono text-[10px] text-primary/80">
              0x14a2f0...f00d...baad...c0de...deee...4422...1100...ffaa
            </pre>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-sm border-l-4 border-primary bg-surface-container-highest p-4">
            <h4 className="mb-2 font-headline text-xs font-bold uppercase">AI Reasoning Engine</h4>
            <p className="text-[11px] leading-relaxed text-on-surface-variant">
              Pattern matching identified a Recursive Call loop consistent with re-entrancy exploit
              attempts. AI Layer injected a Circuit Breaker signal to the destination contract at
              Block 18,442,001.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="rounded-sm bg-primary py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary"
            >
              Release Funds
            </button>
            <button
              type="button"
              className="rounded-sm border border-outline-variant bg-surface-container-low py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface"
            >
              Mark as False Positive
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
