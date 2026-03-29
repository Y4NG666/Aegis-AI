import { ControlPlanePanel } from "@/components/dashboard/control-plane-panel";
import { DashboardMetrics } from "@/components/dashboard/dashboard-metrics";
import { LiveAiLogsPanel } from "@/components/dashboard/live-ai-logs-panel";
import { ProtocolHealthPanel } from "@/components/dashboard/protocol-health-panel";
import { RecentInterventionsPanel } from "@/components/dashboard/recent-interventions-panel";
import { SecurityHeartbeatPanel } from "@/components/dashboard/security-heartbeat-panel";

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-6 pb-24 md:px-8 lg:px-10">
      <header className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary">
          Autonomous Security Operations
        </p>
        <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface">
          Sentinel Overview
        </h1>
        <p className="max-w-3xl text-sm text-on-surface-variant">
          AI-driven governance for Web3 infrastructure. Monitor threats, orchestrate response
          workflows, and keep cross-chain systems in a resilient autonomous state.
        </p>
      </header>

      <DashboardMetrics />

      <ControlPlanePanel />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <SecurityHeartbeatPanel />
        </div>
        <div className="lg:col-span-4">
          <LiveAiLogsPanel />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <ProtocolHealthPanel />
        <RecentInterventionsPanel />
      </section>
    </div>
  );
}
