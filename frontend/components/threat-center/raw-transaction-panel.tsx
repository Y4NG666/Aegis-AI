"use client";

import { motion } from "framer-motion";

import { MaterialIcon } from "@/components/ui/material-icon";
import { threatCallFlow } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const callToneStyles = {
  neutral: "bg-surface-container-highest/40",
  danger: "border-l-2 border-tertiary bg-surface-container-highest/40",
  muted: "bg-surface-container-highest/30 opacity-50",
};

export function RawTransactionPanel() {
  return (
    <motion.section
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.12 }}
      className="space-y-6 rounded-lg bg-surface-container-low p-6"
    >
      <h3 className="flex items-center gap-2 font-headline text-lg font-semibold">
        <MaterialIcon icon="database" className="text-primary" />
        RAW TRANSACTION DATA
      </h3>

      <div className="space-y-4">
        <div className="rounded border border-outline-variant/10 bg-surface-container p-4">
          <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
            Transaction Hash
          </p>
          <div className="flex items-center justify-between gap-4">
            <code className="break-all font-mono text-xs text-primary">
              0x742d35Cc6634C0532925a3b844Bc454e4438f44e2b1928374
            </code>
            <MaterialIcon icon="content_copy" className="cursor-pointer text-sm text-on-surface-variant" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded border border-outline-variant/10 bg-surface-container p-4">
            <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
              Caller Address
            </p>
            <code className="font-mono text-xs text-on-surface">0x1234...abcd</code>
          </div>

          <div className="rounded border border-outline-variant/10 bg-surface-container p-4">
            <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
              Target Protocol
            </p>
            <div className="flex items-center gap-2">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-surface-bright">
                <MaterialIcon icon="account_balance" className="text-[10px]" />
              </div>
              <span className="font-headline text-sm font-medium">Aave V3</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
            Internal Call Flow
            <span className="h-px flex-1 bg-outline-variant/20" />
          </h4>

          <div className="space-y-2 font-mono text-[11px]">
            {threatCallFlow.map((item) => (
              <div
                key={`${item.step}-${item.action}`}
                className={cn("flex items-center gap-3 rounded p-3", callToneStyles[item.tone])}
              >
                <span className={item.tone === "danger" ? "text-tertiary" : "text-on-surface-variant"}>
                  {item.step}
                </span>
                <span className={item.tone === "danger" ? "text-tertiary" : "text-on-surface-variant"}>
                  {item.type}
                </span>
                <span className={item.tone === "danger" ? "text-tertiary" : "text-primary"}>
                  {item.action}
                </span>
                <span className="ml-auto text-on-surface-variant">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
