"use client";

import { AnimatePresence, motion } from "framer-motion";

import { AppFooter } from "@/components/layout/app-footer";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useUIStore } from "@/store/ui-store";

type DashboardShellProps = {
  children: React.ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  const mobileSidebarOpen = useUIStore((state) => state.mobileSidebarOpen);
  const closeMobileSidebar = useUIStore((state) => state.closeMobileSidebar);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <AppSidebar className="fixed left-0 top-0 hidden md:flex" />

      <AnimatePresence>
        {!isDesktop && mobileSidebarOpen ? (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/70"
              onClick={closeMobileSidebar}
            />
            <motion.div
              className="relative h-full w-[18rem]"
              initial={{ x: -48, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -48, opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <AppSidebar className="h-full w-full" />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="md:pl-64">
        <AppTopbar />
        <main className="pb-16">{children}</main>
      </div>

      <AppFooter />
    </div>
  );
}
