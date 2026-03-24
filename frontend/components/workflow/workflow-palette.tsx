"use client";

import { motion } from "framer-motion";

import { MaterialIcon } from "@/components/ui/material-icon";
import { workflowPalette } from "@/lib/mock-data";

type PaletteSectionProps = {
  title: string;
  items: { icon: string; label: string; tone: string }[];
  dotClass: string;
};

function PaletteSection({ title, items, dotClass }: PaletteSectionProps) {
  return (
    <div>
      <h4 className="mb-4 flex items-center gap-2 font-headline text-[10px] font-bold uppercase tracking-[0.24em] text-on-surface">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        {title}
      </h4>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex cursor-grab items-center gap-3 border border-outline-variant/20 bg-surface-container p-3 transition-all hover:border-primary/40 active:cursor-grabbing"
          >
            <MaterialIcon icon={item.icon} className={`text-sm ${item.tone}`} />
            <span className="text-xs font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkflowPalette() {
  return (
    <motion.aside
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 }}
      className="w-full border-t border-outline-variant/10 bg-surface-container-low md:w-72 md:border-l md:border-t-0"
    >
      <div className="space-y-8 p-6">
        <PaletteSection title="Triggers" items={workflowPalette.triggers} dotClass="bg-primary animate-pulse-lite" />
        <PaletteSection title="Filters" items={workflowPalette.filters} dotClass="bg-on-surface-variant" />
        <PaletteSection title="Actions" items={workflowPalette.actions} dotClass="bg-tertiary-container" />
      </div>
    </motion.aside>
  );
}
