"use client";

import { useEffect } from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";

import {
  connectInjectedWallet,
  disconnectInjectedWallet,
  getBrowserProvider,
  getBrowserSigner,
  readWalletSession,
  subscribeToWalletEvents,
} from "@/lib/wallet";
import { getEthereumProvider } from "@/lib/ethereum";
import { useUIStore } from "@/store/ui-store";

export type ConnectedWallet = {
  provider: BrowserProvider;
  signer: JsonRpcSigner;
  address: string;
  chainId: number;
};

let walletBootstrapped = false;
let walletBootstrapPromise: Promise<void> | null = null;
let walletConnectPromise: Promise<ConnectedWallet> | null = null;
let walletEventSubscriptionCount = 0;
let walletEventsUnsubscribe: (() => void) | null = null;

function formatWalletError(error: unknown) {
  return error instanceof Error ? error.message : "Wallet connection failed";
}

function setWalletState(payload: {
  walletAddress?: string | null;
  walletChainId?: number | null;
  walletConnecting?: boolean;
  walletError?: string | null;
}) {
  useUIStore.setState(payload);
}

async function buildConnectedWalletFromProvider(provider: BrowserProvider): Promise<ConnectedWallet> {
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  const address = await signer.getAddress();

  return {
    provider,
    signer,
    address,
    chainId: Number(network.chainId),
  };
}

async function syncWalletState({
  requestAccess = false,
  setLoading = false,
}: {
  requestAccess?: boolean;
  setLoading?: boolean;
} = {}): Promise<ConnectedWallet | null> {
  if (setLoading) {
    setWalletState({
      walletConnecting: true,
      walletError: null,
    });
  }

  try {
    const session = await readWalletSession(requestAccess);

    if (!session.walletAddress || session.chainId === null) {
      setWalletState({
        walletAddress: null,
        walletChainId: null,
        walletConnecting: false,
        walletError: null,
      });
      return null;
    }

    const provider = getBrowserProvider();
    const signer = await provider.getSigner();

    setWalletState({
      walletAddress: session.walletAddress,
      walletChainId: session.chainId,
      walletConnecting: false,
      walletError: null,
    });

    return {
      provider,
      signer,
      address: session.walletAddress,
      chainId: session.chainId,
    };
  } catch (error) {
    setWalletState({
      walletConnecting: false,
      walletError: formatWalletError(error),
    });
    throw error;
  }
}

async function bootstrapWallet() {
  if (walletBootstrapped) {
    return;
  }

  if (walletBootstrapPromise) {
    return walletBootstrapPromise;
  }

  walletBootstrapPromise = syncWalletState()
    .then(() => undefined)
    .catch((error) => {
      console.error("[wallet] auto-connect failed", error);
    })
    .finally(() => {
      walletBootstrapped = true;
      walletBootstrapPromise = null;
    });

  return walletBootstrapPromise;
}

function handleWalletProviderEvent(event: "accountsChanged" | "chainChanged") {
  console.info(`[wallet] provider event received: ${event}`);
  syncWalletState()
    .then((session) => {
      if (!session) {
        console.info("[wallet] session cleared after provider event");
      }
    })
    .catch((error) => {
      console.error(`[wallet] unable to sync after ${event}`, error);
    });
}

export function getProvider(): BrowserProvider {
  return getBrowserProvider();
}

export async function getSigner(): Promise<JsonRpcSigner> {
  const signer = await getBrowserSigner();
  const provider = getProvider();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();

  setWalletState({
    walletAddress: address,
    walletChainId: Number(network.chainId),
    walletError: null,
  });

  return signer;
}

export async function connectWallet(): Promise<ConnectedWallet> {
  if (walletConnectPromise) {
    console.log("[wallet] reusing connectWallet promise");
    return walletConnectPromise;
  }

  const state = useUIStore.getState();
  if (state.walletAddress && state.walletChainId !== null) {
    console.log("[wallet] connect skipped because wallet is already connected");
    return buildConnectedWalletFromProvider(getProvider());
  }

  walletConnectPromise = (async () => {
    setWalletState({
      walletConnecting: true,
      walletError: null,
    });

    try {
      if (!getEthereumProvider()) {
        const message = "MetaMask is not installed in this browser";
        setWalletState({
          walletConnecting: false,
          walletError: message,
        });
        throw new Error(message);
      }

      console.log("[wallet] connectWallet invoking eth_requestAccounts");
      const session = await connectInjectedWallet();
      console.log("[wallet] connectWallet received session", {
        address: session.walletAddress,
        chainId: session.chainId,
      });
      setWalletState({
        walletAddress: session.walletAddress,
        walletChainId: session.chainId,
        walletConnecting: false,
        walletError: null,
      });

      return {
        provider: session.provider,
        signer: session.signer,
        address: session.walletAddress,
        chainId: session.chainId,
      };
    } catch (error) {
      console.error("[wallet] connectWallet failed", error);
      setWalletState({
        walletConnecting: false,
        walletError: formatWalletError(error),
      });
      throw error;
    }
  })().finally(() => {
    walletConnectPromise = null;
  });

  return walletConnectPromise;
}

export function disconnectWallet() {
  disconnectInjectedWallet();
  setWalletState({
    walletAddress: null,
    walletChainId: null,
    walletConnecting: false,
    walletError: null,
  });
}

export function useWallet() {
  const walletAddress = useUIStore((state) => state.walletAddress);
  const walletChainId = useUIStore((state) => state.walletChainId);
  const walletConnecting = useUIStore((state) => state.walletConnecting);
  const walletError = useUIStore((state) => state.walletError);

  useEffect(() => {
    void bootstrapWallet();

    walletEventSubscriptionCount += 1;
    if (walletEventSubscriptionCount === 1) {
      walletEventsUnsubscribe = subscribeToWalletEvents(handleWalletProviderEvent);
    }

    return () => {
      walletEventSubscriptionCount = Math.max(walletEventSubscriptionCount - 1, 0);

      if (walletEventSubscriptionCount === 0) {
        walletEventsUnsubscribe?.();
        walletEventsUnsubscribe = null;
      }
    };
  }, []);

  return {
    address: walletAddress,
    chainId: walletChainId,
    isConnected: Boolean(walletAddress),
    isConnecting: walletConnecting,
    error: walletError,
    connectWallet,
    disconnectWallet,
    getProvider,
    getSigner,
  };
}
