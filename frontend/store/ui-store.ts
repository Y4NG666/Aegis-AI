"use client";

import { create } from "zustand";

import { forensicRows } from "@/lib/mock-data";

type Chain = "Mainnet" | "Arbitrum" | "Optimism";

type UIState = {
  activeChain: Chain;
  mobileSidebarOpen: boolean;
  walletAddress: string | null;
  selectedForensicsId: string;
  setActiveChain: (chain: Chain) => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  connectWallet: () => void;
  disconnectWallet: () => void;
  setSelectedForensicsId: (id: string) => void;
};

export const useUIStore = create<UIState>((set) => ({
  activeChain: "Mainnet",
  mobileSidebarOpen: false,
  walletAddress: null,
  selectedForensicsId: forensicRows[0].id,
  setActiveChain: (chain) => set({ activeChain: chain }),
  toggleMobileSidebar: () =>
    set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  connectWallet: () => set({ walletAddress: "0x71C7dE3A4A1f2F0eB2310a17d44B5C9d9E8A33E4" }),
  disconnectWallet: () => set({ walletAddress: null }),
  setSelectedForensicsId: (id) => set({ selectedForensicsId: id }),
}));
