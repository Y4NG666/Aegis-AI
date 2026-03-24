"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MaterialIcon } from "@/components/ui/material-icon";
import { navigationItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";

type AppSidebarProps = {
  className?: string;
};

export function AppSidebar({ className }: AppSidebarProps) {
  const pathname = usePathname();
  const closeMobileSidebar = useUIStore((state) => state.closeMobileSidebar);

  return (
    <aside
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r border-outline-variant/10 bg-[#0B0E14] py-8",
        className,
      )}
    >
      <div className="mb-10 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-highest">
            <MaterialIcon icon="security" filled className="text-primary" />
          </div>
          <div>
            <h2 className="font-headline text-sm font-bold tracking-[0.22em] text-on-surface">
              SENTINEL-01
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              Autonomous Mode: Active
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4">
        {navigationItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={closeMobileSidebar}
              className={cn(
                "flex items-center gap-3 px-4 py-3 font-headline text-sm font-medium transition-all duration-200",
                isActive
                  ? "border-l-2 border-primary bg-surface-container text-[#CCFF00]"
                  : "text-slate-400 hover:bg-surface-container/50 hover:text-on-surface",
              )}
            >
              <MaterialIcon icon={item.icon} filled={isActive} className="text-lg" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-4">
        <button
          type="button"
          className="w-full bg-tertiary-container py-4 font-headline text-xs font-bold tracking-[0.2em] text-on-tertiary hover:brightness-110"
        >
          EMERGENCY PROTOCOL
        </button>
      </div>
    </aside>
  );
}
