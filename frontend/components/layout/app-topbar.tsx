"use client";

import { usePathname } from "next/navigation";

import { ConnectWalletButton } from "@/components/ui/connect-wallet-button";
import { MaterialIcon } from "@/components/ui/material-icon";
import { chainTabs, routeLabels } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";

export function AppTopbar() {
  const pathname = usePathname();
  const activeChain = useUIStore((state) => state.activeChain);
  const setActiveChain = useUIStore((state) => state.setActiveChain);
  const toggleMobileSidebar = useUIStore((state) => state.toggleMobileSidebar);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-outline-variant/5 bg-[#0B0E14]/95 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-4 lg:gap-8">
        <button
          type="button"
          onClick={toggleMobileSidebar}
          className="inline-flex items-center justify-center text-slate-400 hover:text-primary md:hidden"
        >
          <MaterialIcon icon="menu" className="text-[22px]" />
        </button>

        <div className="flex flex-col">
          <span className="font-headline text-lg font-bold tracking-tight text-[#CCFF00] md:text-xl">
            AEGIS AI GUARDIAN
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-on-surface-variant md:hidden">
            {routeLabels[pathname] ?? "Operations"}
          </span>
        </div>

        <div className="hidden items-center gap-6 lg:flex">
          {chainTabs.map((chain) => (
            <button
              key={chain}
              type="button"
              onClick={() => setActiveChain(chain)}
              className={cn(
                "pb-1 font-headline text-xs uppercase tracking-tight transition-colors",
                activeChain === chain
                  ? "border-b border-[#CCFF00] text-[#CCFF00]"
                  : "text-slate-500 hover:text-[#CCFF00]",
              )}
            >
              {chain}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden items-center gap-2 rounded-sm bg-surface-container px-4 py-2 lg:flex">
          <MaterialIcon icon="search" className="text-base text-on-surface-variant" />
          <span className="font-mono text-[10px] tracking-[0.24em] text-slate-500">
            SEARCH_NETWORK...
          </span>
        </div>

        <button
          type="button"
          className="p-2 text-slate-500 hover:text-[#CCFF00] active:scale-95"
        >
          <MaterialIcon icon="monitor_heart" />
        </button>

        <ConnectWalletButton className="hidden sm:inline-flex" />

        <button
          type="button"
          className="p-2 text-slate-500 hover:text-[#CCFF00] active:scale-95"
        >
          <MaterialIcon icon="account_circle" />
        </button>
      </div>
    </header>
  );
}
