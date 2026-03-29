"use client";

import { create } from "zustand";

import {
  fetchSystemState,
  startMonitor as startMonitorRequest,
  triggerDemoEvent as triggerDemoEventRequest,
  type DemoTriggerResponse,
  type SystemState,
} from "@/lib/api";
import { forensicRows } from "@/lib/mock-data";
import {
  connectInjectedWallet,
  disconnectInjectedWallet,
  readWalletSession,
} from "@/lib/wallet";

type Chain = "Mainnet" | "Arbitrum" | "Optimism";

type UIState = {
  activeChain: Chain;
  mobileSidebarOpen: boolean;
  forensicsQuickViewOpen: boolean;
  walletAddress: string | null;
  walletChainId: number | null;
  walletConnecting: boolean;
  walletError: string | null;
  selectedForensicsId: string;
  systemState: SystemState | null;
  systemLoading: boolean;
  systemError: string | null;
  actionPending: boolean;
  actionError: string | null;
  lastDemoTrigger: DemoTriggerResponse | null;
  setActiveChain: (chain: Chain) => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  openForensicsQuickView: () => void;
  closeForensicsQuickView: () => void;
  setSelectedForensicsId: (id: string) => void;
  setSystemState: (systemState: SystemState) => void;
  setSystemError: (error: string | null) => void;
  setWalletError: (error: string | null) => void;
  setWalletSession: (walletAddress: string | null, chainId: number | null) => void;
  refreshSystemState: (subjectAddress?: string) => Promise<void>;
  hydrateWalletSession: () => Promise<void>;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  startMonitor: () => Promise<void>;
  triggerDemoEvent: () => Promise<DemoTriggerResponse>;
};

function formatError(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected request failure";
}

export const useUIStore = create<UIState>((set) => ({
  activeChain: "Mainnet",
  mobileSidebarOpen: false,
  forensicsQuickViewOpen: true,
  walletAddress: null,
  walletChainId: null,
  walletConnecting: false,
  walletError: null,
  selectedForensicsId: forensicRows[0].id,
  systemState: null,
  systemLoading: false,
  systemError: null,
  actionPending: false,
  actionError: null,
  lastDemoTrigger: null,
  setActiveChain: (chain) => set({ activeChain: chain }),
  toggleMobileSidebar: () =>
    set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  openForensicsQuickView: () => set({ forensicsQuickViewOpen: true }),
  closeForensicsQuickView: () => set({ forensicsQuickViewOpen: false }),
  setSelectedForensicsId: (id) =>
    set({
      selectedForensicsId: id,
      forensicsQuickViewOpen: true,
    }),
  setSystemState: (systemState) => set({ systemState }),
  setSystemError: (systemError) => set({ systemError }),
  setWalletError: (walletError) => set({ walletError }),
  setWalletSession: (walletAddress, walletChainId) => set({ walletAddress, walletChainId }),
  refreshSystemState: async (subjectAddress) => {
    set({ systemLoading: true });
    try {
      const systemState = await fetchSystemState(subjectAddress);
      set({
        systemState,
        systemError: null,
        systemLoading: false,
      });
    } catch (error) {
      set({
        systemError: formatError(error),
        systemLoading: false,
      });
    }
  },
  hydrateWalletSession: async () => {
    try {
      const session = await readWalletSession(false);
      set({
        walletAddress: session.walletAddress,
        walletChainId: session.chainId,
        walletError: null,
      });
    } catch (error) {
      set({
        walletError: formatError(error),
      });
    }
  },
  connectWallet: async () => {
    set({
      walletConnecting: true,
      walletError: null,
    });

    try {
      const session = await connectInjectedWallet();
      set({
        walletAddress: session.walletAddress,
        walletChainId: session.chainId,
        walletConnecting: false,
        walletError: null,
      });
    } catch (error) {
      set({
        walletConnecting: false,
        walletError: formatError(error),
      });
    }
  },
  disconnectWallet: () => {
    disconnectInjectedWallet();
    set({
      walletAddress: null,
      walletChainId: null,
      walletConnecting: false,
      walletError: null,
    });
  },
  startMonitor: async () => {
    set({
      actionPending: true,
      actionError: null,
    });

    try {
      await startMonitorRequest();
      const systemState = await fetchSystemState();
      set({
        systemState,
        actionPending: false,
        actionError: null,
      });
    } catch (error) {
      set({
        actionPending: false,
        actionError: formatError(error),
      });
    }
  },
  triggerDemoEvent: async () => {
    set({
      actionPending: true,
      actionError: null,
    });

    try {
      const lastDemoTrigger = await triggerDemoEventRequest();
      const systemState = lastDemoTrigger.system_state ?? (await fetchSystemState());
      set({
        lastDemoTrigger,
        systemState,
        actionPending: false,
        actionError: null,
      });
      return lastDemoTrigger;
    } catch (error) {
      set({
        actionPending: false,
        actionError: formatError(error),
      });
      throw error;
    }
  },
}));
