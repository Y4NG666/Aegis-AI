"use client";

import { useEffect } from "react";

import { useUIStore } from "@/store/ui-store";

export function SystemSync() {
  const refreshSystemState = useUIStore((state) => state.refreshSystemState);
  const setSystemError = useUIStore((state) => state.setSystemError);

  useEffect(() => {
    void refreshSystemState();

    const poll = () => {
      refreshSystemState().catch((error: unknown) => {
        setSystemError(error instanceof Error ? error.message : "Unable to poll backend /status");
      });
    };
    const interval = window.setInterval(poll, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [refreshSystemState, setSystemError]);

  return null;
}
