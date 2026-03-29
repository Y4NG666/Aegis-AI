import { BrowserProvider, JsonRpcSigner, getAddress } from "ethers";

import {
  type EthereumEventHandler,
  type EthereumProvider,
  getEthereumProvider,
} from "@/lib/ethereum";

export type WalletSession = {
  walletAddress: string | null;
  chainId: number | null;
};

export type ConnectedWalletSession = {
  walletAddress: string;
  chainId: number;
  provider: BrowserProvider;
  signer: JsonRpcSigner;
};

const WALLET_DISCONNECT_FLAG = "aegis.wallet.disconnected";

let providerInstance: BrowserProvider | null = null;
let sessionPromise: Promise<WalletSession> | null = null;
let connectionPromise: Promise<ConnectedWalletSession> | null = null;
let subscribedProvider: EthereumProvider | null = null;
let accountsChangedHandler: EthereumEventHandler | null = null;
let chainChangedHandler: EthereumEventHandler | null = null;

const walletEventSubscribers = new Set<(event: "accountsChanged" | "chainChanged") => void>();

function normalizeAddress(value: unknown) {
  return typeof value === "string" && value ? getAddress(value) : null;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function setDisconnectedFlag(disconnected: boolean) {
  if (!canUseStorage()) {
    return;
  }

  if (disconnected) {
    window.localStorage.setItem(WALLET_DISCONNECT_FLAG, "1");
    return;
  }

  window.localStorage.removeItem(WALLET_DISCONNECT_FLAG);
}

function isDisconnectedFlagSet() {
  if (!canUseStorage()) {
    return false;
  }

  return window.localStorage.getItem(WALLET_DISCONNECT_FLAG) === "1";
}

function getInjectedProviderOrThrow() {
  const ethereum = getEthereumProvider();
  if (!ethereum) {
    throw new Error("MetaMask is not installed in this browser");
  }

  return ethereum;
}

async function requestWallet(method: string, params?: unknown[] | object) {
  const ethereum = getInjectedProviderOrThrow();
  console.log(`[wallet] request -> ${method}`, params ?? null);
  return ethereum.request({ method, params });
}

export function getBrowserProvider() {
  const ethereum = getInjectedProviderOrThrow();

  if (!providerInstance) {
    providerInstance = new BrowserProvider(ethereum);
  }

  return providerInstance;
}

export async function getBrowserSigner() {
  const provider = getBrowserProvider();
  return provider.getSigner();
}

async function loadWalletSession({
  requestAccess,
  respectDisconnectFlag,
}: {
  requestAccess: boolean;
  respectDisconnectFlag: boolean;
}): Promise<WalletSession> {
  const ethereum = getEthereumProvider();
  if (!ethereum) {
    return {
      walletAddress: null,
      chainId: null,
    };
  }

  if (!requestAccess && respectDisconnectFlag && isDisconnectedFlagSet()) {
    return {
      walletAddress: null,
      chainId: null,
    };
  }

  if (requestAccess) {
    await requestWallet("eth_requestAccounts", []);
    setDisconnectedFlag(false);
  }

  const provider = getBrowserProvider();
  const accountsValue = await provider.send("eth_accounts", []);
  const accounts = Array.isArray(accountsValue) ? accountsValue : [];
  const network = await provider.getNetwork();

  return {
    walletAddress: normalizeAddress(accounts[0]),
    chainId: Number(network.chainId),
  };
}

export async function connectInjectedWallet(): Promise<ConnectedWalletSession> {
  if (connectionPromise) {
    console.log("[wallet] reusing in-flight connect request");
    return connectionPromise;
  }

  connectionPromise = (async () => {
    let accountsResponse: unknown;

    try {
      console.log("[wallet] requesting MetaMask accounts");
      accountsResponse = await requestWallet("eth_requestAccounts", []);
      console.log("[wallet] MetaMask accounts response", accountsResponse);
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? Number((error as { code?: unknown }).code)
          : null;

      if (code === 4001) {
        console.error("[wallet] MetaMask connection request rejected by user", error);
        throw new Error("MetaMask connection request was rejected");
      }

      console.error("[wallet] MetaMask connection request failed", error);
      throw error;
    }

    const provider = getBrowserProvider();
    const signer = await provider.getSigner();
    const network = await provider.getNetwork();
    const walletAddress = normalizeAddress(await signer.getAddress());

    if (!walletAddress) {
      throw new Error("MetaMask did not return a valid wallet address");
    }

    setDisconnectedFlag(false);
    console.log("[wallet] wallet connected", {
      walletAddress,
      chainId: Number(network.chainId),
    });

    return {
      provider,
      signer,
      walletAddress,
      chainId: Number(network.chainId),
    };
  })().finally(() => {
    connectionPromise = null;
  });

  return connectionPromise;
}

export async function readWalletSession(requestAccess = false): Promise<WalletSession> {
  if (requestAccess) {
    return loadWalletSession({
      requestAccess: true,
      respectDisconnectFlag: false,
    });
  }

  if (sessionPromise) {
    return sessionPromise;
  }

  sessionPromise = loadWalletSession({
    requestAccess: false,
    respectDisconnectFlag: true,
  }).finally(() => {
    sessionPromise = null;
  });

  return sessionPromise;
}

export function disconnectInjectedWallet() {
  providerInstance = null;
  setDisconnectedFlag(true);
}

function removeProviderListeners() {
  if (!subscribedProvider) {
    return;
  }

  if (accountsChangedHandler) {
    subscribedProvider.removeListener?.("accountsChanged", accountsChangedHandler);
  }

  if (chainChangedHandler) {
    subscribedProvider.removeListener?.("chainChanged", chainChangedHandler);
  }

  subscribedProvider = null;
  accountsChangedHandler = null;
  chainChangedHandler = null;
}

function ensureProviderListeners() {
  const ethereum = getEthereumProvider();

  if (!ethereum?.on) {
    removeProviderListeners();
    return;
  }

  if (subscribedProvider === ethereum) {
    return;
  }

  removeProviderListeners();

  accountsChangedHandler = () => {
    walletEventSubscribers.forEach((subscriber) => subscriber("accountsChanged"));
  };
  chainChangedHandler = () => {
    walletEventSubscribers.forEach((subscriber) => subscriber("chainChanged"));
  };

  ethereum.on("accountsChanged", accountsChangedHandler);
  ethereum.on("chainChanged", chainChangedHandler);
  subscribedProvider = ethereum;
}

export function subscribeToWalletEvents(
  subscriber: (event: "accountsChanged" | "chainChanged") => void,
) {
  walletEventSubscribers.add(subscriber);
  ensureProviderListeners();

  return () => {
    walletEventSubscribers.delete(subscriber);

    if (walletEventSubscribers.size === 0) {
      removeProviderListeners();
    }
  };
}
