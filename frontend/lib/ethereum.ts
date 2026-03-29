export type EthereumEventHandler = (...args: unknown[]) => void;

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: EthereumEventHandler) => void;
  removeListener?: (event: string, handler: EthereumEventHandler) => void;
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
};

export function getEthereumProvider(): EthereumProvider | null {
  const scope = globalThis as typeof globalThis & { ethereum?: EthereumProvider };
  const injected = scope.ethereum ?? null;

  if (!injected) {
    return null;
  }

  if (Array.isArray(injected.providers) && injected.providers.length > 0) {
    return (
      injected.providers.find((provider) => provider.isMetaMask) ??
      injected.providers[0] ??
      injected
    );
  }

  return injected;
}
