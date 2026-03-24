"use client";

import { motion } from "framer-motion";

export function WorkflowEditorHeader() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-16 items-center justify-between border-b border-outline-variant/10 bg-surface-container-low px-6 md:px-8"
    >
      <div className="flex items-center gap-4">
        <h1 className="font-headline text-lg font-bold tracking-tight">Flash Loan Mitigation V2</h1>
        <span className="rounded-sm bg-surface-container-highest px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          Draft
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="px-4 py-1.5 font-headline text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant hover:text-on-surface"
        >
          Discard
        </button>
        <button
          type="button"
          className="rounded-sm bg-primary px-6 py-1.5 font-headline text-xs font-bold uppercase tracking-[0.18em] text-on-primary hover:shadow-glow"
        >
          Deploy Rule
        </button>
      </div>
    </motion.section>
  );
}
