"use client";

import { motion } from "framer-motion";

import { MaterialIcon } from "@/components/ui/material-icon";
import { StatusPill } from "@/components/ui/status-pill";
import { protocolHealth } from "@/lib/mock-data";

export function ProtocolHealthPanel() {
  return (
    <section>
      <h3 className="mb-6 flex items-center gap-2 font-headline text-lg font-bold">
        <MaterialIcon icon="health_and_safety" className="text-primary" />
        Protocol Health
      </h3>

      <div className="space-y-4">
        {protocolHealth.map((protocol, index) => (
          <motion.article
            key={protocol.name}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 + 0.32 }}
            className="group flex items-center justify-between bg-surface-container-low p-5 transition-colors hover:bg-surface-container"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center bg-surface-container text-on-surface-variant transition-colors group-hover:text-primary">
                <MaterialIcon icon={protocol.icon} filled className="text-lg" />
              </div>
              <div>
                <h4 className="font-headline text-sm font-bold tracking-tight">{protocol.name}</h4>
                <p className="text-[11px] text-on-surface-variant">{protocol.detail}</p>
              </div>
            </div>

            <StatusPill
              label={protocol.status}
              tone={protocol.tone === "danger" ? "danger" : "primary"}
            />
          </motion.article>
        ))}
      </div>
    </section>
  );
}
