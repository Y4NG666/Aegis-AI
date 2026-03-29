"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import { useWallet } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";

type DisconnectWalletButtonProps = {
  className?: string;
};

export function DisconnectWalletButton({
  className,
}: DisconnectWalletButtonProps) {
  const { address, isConnected, isConnecting, disconnectWallet } = useWallet();

  if (!isConnected) {
    return null;
  }

  function handleClick() {
    if (isConnecting) {
      return;
    }

    console.info("[wallet-button] disconnect requested");
    disconnectWallet();
    console.info("[wallet-button] disconnected from local app state");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isConnecting}
      title={address ?? "Disconnect wallet"}
      className={cn(
        "inline-flex items-center gap-2 rounded-sm border border-tertiary/35 bg-tertiary/10 px-3 py-2 text-[11px] font-headline font-bold uppercase tracking-[0.18em] text-tertiary transition-colors hover:bg-tertiary/15 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <MaterialIcon icon="logout" className="text-base" />
      <span>Disconnect</span>
    </button>
  );
}
