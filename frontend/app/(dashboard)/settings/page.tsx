"use client";

import { ConnectWalletButton } from "@/components/ui/connect-wallet-button";
import { DisconnectWalletButton } from "@/components/ui/disconnect-wallet-button";
import { MaterialIcon } from "@/components/ui/material-icon";
import { useAsyncButtonAction } from "@/hooks/use-async-button-action";
import { syncSettingItem } from "@/lib/button-actions";
import { useUIStore } from "@/store/ui-store";

const settingsGroups = [
  {
    title: "Response Profiles",
    description: "Configure how autonomous security rules react across chains and protocols.",
    items: ["Emergency pause guard", "Cross-chain callback validation", "DAO escalation threshold"],
  },
  {
    title: "Operator Preferences",
    description: "Tune routing, notification policies, and manual override constraints.",
    items: ["Discord and Telegram alerts", "Incident owner assignment", "Safe execution allowlist"],
  },
];

function SettingsActionRow({ item }: { item: string }) {
  const setSystemState = useUIStore((state) => state.setSystemState);
  const action = useAsyncButtonAction({
    label: `Settings:${item}`,
    action: async () => {
      const result = await syncSettingItem(item);
      setSystemState(result.snapshot.systemState);
      return result;
    },
    getSuccessMessage: (result) =>
      `${result.item} synced from ${result.snapshot.systemState.deployment.network ?? "backend"}`,
  });

  return (
    <div className="flex items-center justify-between rounded-sm border border-outline-variant/20 bg-surface-container-low p-4">
      <span className="text-sm">{item}</span>
      <button
        type="button"
        onClick={() => void action.run()}
        disabled={action.isLoading}
        title={action.error ?? action.feedback ?? `Load current state for ${item}`}
        className="rounded-full border border-outline-variant/20 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-on-surface-variant hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {action.isLoading
          ? "Syncing..."
          : action.isSuccess
            ? "Synced"
            : action.isError
              ? "Retry"
              : "Edit"}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 pb-24 md:px-8 lg:px-10">
      <header className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary">Control Layer</p>
        <h1 className="font-headline text-4xl font-bold tracking-tight">Settings</h1>
        <p className="max-w-3xl text-sm text-on-surface-variant">
          Manage connection surfaces, guardian defaults, and operator-level preferences for the
          Aegis control plane.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {settingsGroups.map((group) => (
          <article key={group.title} className="space-y-4 rounded-lg bg-surface-container p-6">
            <div>
              <h2 className="font-headline text-xl font-bold">{group.title}</h2>
              <p className="mt-2 text-sm text-on-surface-variant">{group.description}</p>
            </div>

            <div className="space-y-3">
              {group.items.map((item) => (
                <SettingsActionRow key={item} item={item} />
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-outline-variant/10 bg-surface-container-low p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MaterialIcon icon="account_balance_wallet" className="text-primary" />
              <h2 className="font-headline text-lg font-bold">Wallet Interface Placeholder</h2>
            </div>
            <p className="max-w-2xl text-sm text-on-surface-variant">
              MetaMask connectivity is live here now, so operator changes can authenticate against
              the active wallet without replacing the existing settings UI.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ConnectWalletButton />
            <DisconnectWalletButton />
          </div>
        </div>
      </section>
    </div>
  );
}
