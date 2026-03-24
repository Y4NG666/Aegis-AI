"use client";

import { useState } from "react";

const riskLevels = ["High", "Med", "Low"] as const;

export function ForensicsFilters() {
  const [selectedRisk, setSelectedRisk] = useState<(typeof riskLevels)[number]>("High");

  return (
    <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
      <div className="rounded-lg bg-surface-container p-4">
        <label className="mb-2 block font-headline text-[10px] uppercase tracking-[0.24em] text-on-surface-variant">
          Chain Network
        </label>
        <select className="w-full rounded-sm border-none bg-surface-container-lowest text-xs text-on-surface focus:ring-1 focus:ring-primary">
          <option>All Networks</option>
          <option>Ethereum Mainnet</option>
          <option>Arbitrum One</option>
          <option>Optimism</option>
          <option>Polygon</option>
        </select>
      </div>

      <div className="rounded-lg bg-surface-container p-4">
        <label className="mb-2 block font-headline text-[10px] uppercase tracking-[0.24em] text-on-surface-variant">
          Protocol Tier
        </label>
        <select className="w-full rounded-sm border-none bg-surface-container-lowest text-xs text-on-surface focus:ring-1 focus:ring-primary">
          <option>All Protocols</option>
          <option>Liquidity Pools</option>
          <option>Governance Contracts</option>
          <option>Cross-chain Bridges</option>
        </select>
      </div>

      <div className="rounded-lg bg-surface-container p-4">
        <label className="mb-2 block font-headline text-[10px] uppercase tracking-[0.24em] text-on-surface-variant">
          Risk Parameter
        </label>
        <div className="flex gap-2">
          {riskLevels.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setSelectedRisk(level)}
              className={`flex-1 border py-1 font-headline text-[10px] uppercase transition-colors ${
                selectedRisk === level
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-outline-variant hover:bg-surface-container-high"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-surface-container p-4">
        <label className="mb-2 block font-headline text-[10px] uppercase tracking-[0.24em] text-on-surface-variant">
          AI Action
        </label>
        <select className="w-full rounded-sm border-none bg-surface-container-lowest text-xs text-on-surface focus:ring-1 focus:ring-primary">
          <option>All Actions</option>
          <option>Auto-executed</option>
          <option>Manual Override</option>
          <option>Security Ignored</option>
        </select>
      </div>
    </section>
  );
}
