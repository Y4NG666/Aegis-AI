"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import { useWallet } from "@/hooks/useWallet";
import { cn, shortenAddress } from "@/lib/utils";

type ConnectWalletButtonProps = {
  className?: string;
};

export function ConnectWalletButton({
  className,
}: ConnectWalletButtonProps) {
  const {
    address,
    isConnected,
    isConnecting,
    error,
    connectWallet,
  } = useWallet();
  const hasError = Boolean(error) && !isConnected;
  const buttonLabel = isConnecting
    ? "Connecting..."
    : isConnected
      ? shortenAddress(address as string)
      : hasError
        ? "Retry Wallet"
        : "Connect Wallet";
  const buttonIcon = isConnecting
    ? "progress_activity"
    : isConnected
      ? "verified_user"
      : hasError
        ? "error"
        : "account_balance_wallet";

  async function handleClick() {
    if (isConnecting || isConnected) {
      console.log("[wallet-button] click ignored", {
        isConnecting,
        isConnected,
      });
      return;
    }

    console.log("[wallet-button] connect clicked");

    try {
      await connectWallet();
      console.log("[wallet-button] connect completed");
    } catch (error) {
      console.error("[wallet-button] connect failed", error);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isConnecting || isConnected}
      title={
        error ??
        (isConnected ? `Connected: ${address ?? ""}` : "Connect MetaMask")
      }
      className={cn(
        "inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-[11px] font-headline font-bold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-60",
        isConnected
          ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
          : hasError
            ? "border-tertiary/40 bg-tertiary/10 text-tertiary hover:bg-tertiary/15"
            : "border-outline-variant/30 bg-surface-container text-on-surface hover:border-primary/40 hover:text-primary",
        className,
      )}
    >
      <MaterialIcon icon={buttonIcon} className="text-base" />
      <span>{buttonLabel}</span>
    </button>
  );
}
