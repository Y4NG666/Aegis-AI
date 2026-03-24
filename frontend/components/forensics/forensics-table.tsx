"use client";

import { motion } from "framer-motion";

import { MaterialIcon } from "@/components/ui/material-icon";
import { StatusPill } from "@/components/ui/status-pill";
import { forensicRows } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";

const toneClasses = {
  primary: {
    bar: "bg-primary",
    text: "text-primary",
    pill: "primary" as const,
  },
  warning: {
    bar: "bg-yellow-400",
    text: "text-yellow-400",
    pill: "warning" as const,
  },
  danger: {
    bar: "bg-tertiary-container",
    text: "text-tertiary-container",
    pill: "danger" as const,
  },
};

export function ForensicsTable() {
  const selectedForensicsId = useUIStore((state) => state.selectedForensicsId);
  const setSelectedForensicsId = useUIStore((state) => state.setSelectedForensicsId);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="overflow-hidden rounded-lg bg-surface-container"
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface-container-high">
              {["Time", "Network", "Source Protocol", "Activity", "Confidence", "Status"].map((label) => (
                <th
                  key={label}
                  className="px-6 py-4 font-headline text-[10px] uppercase tracking-[0.24em] text-on-surface-variant"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {forensicRows.map((row) => {
              const tone = toneClasses[row.tone];
              const isSelected = selectedForensicsId === row.id;

              return (
                <tr
                  key={row.id}
                  onClick={() => setSelectedForensicsId(row.id)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-surface-container-highest",
                    isSelected && "bg-surface-container-highest/60",
                  )}
                >
                  <td className="px-6 py-5 font-mono text-[11px] text-on-surface-variant">{row.age}</td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <MaterialIcon icon={row.networkIcon} className={cn("text-sm", row.networkColor)} />
                      <span className="text-xs font-medium">{row.network}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="rounded-sm bg-surface-container-lowest px-2 py-1 font-mono text-xs">
                      {row.source}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold">{row.activity}</span>
                      <span className="text-[10px] text-on-surface-variant">{row.detail}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-container-lowest">
                        <div className={cn("h-full", tone.bar, row.confidenceWidthClass)} />
                      </div>
                      <span className={cn("font-mono text-[10px]", tone.text)}>{row.confidenceLabel}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <StatusPill label={row.status} tone={tone.pill} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.section>
  );
}
