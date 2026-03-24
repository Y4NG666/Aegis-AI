"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import { useUIStore } from "@/store/ui-store";
import { cn, shortenAddress } from "@/lib/utils";

type ConnectWalletButtonProps = {
  className?: string;
};

export function ConnectWalletButton({
  className,
}: ConnectWalletButtonProps) {
  const walletAddress = useUIStore((state) => state.walletAddress);
  const connectWallet = useUIStore((state) => state.connectWallet);
  const disconnectWallet = useUIStore((state) => state.disconnectWallet);

  const isConnected = Boolean(walletAddress);

  return (
    <button
      type="button"
      onClick={isConnected ? disconnectWallet : connectWallet}
      className={cn(
        "inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-[11px] font-headline font-bold uppercase tracking-[0.18em]",
        isConnected
          ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
          : "border-outline-variant/30 bg-surface-container text-on-surface hover:border-primary/40 hover:text-primary",
        className,
      )}
    >
      <MaterialIcon icon="account_balance_wallet" className="text-base" />
      <span>{isConnected ? shortenAddress(walletAddress as string) : "Connect Wallet"}</span>
    </button>
  );
}
