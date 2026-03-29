import type { SystemState } from "@/lib/api";

export type SecurityView = {
  threatLabel: "SAFE" | "ATTACK";
  threatTone: "primary" | "danger";
  riskScore: number;
  protocolStatus: "PAUSED" | "LIVE" | "OFFLINE";
  decisionLabel: string;
};

export function deriveSecurityView(systemState: SystemState | null): SecurityView {
  const latestEvent = systemState?.latest_event;
  const latestAiResult = systemState?.ai.latest_result;
  const guardianState = systemState?.contracts.guardian.state;
  const protocolPaused = Boolean(systemState?.contracts.risk_controller.paused);
  const riskScore = Math.round(
    Math.max(
      latestEvent?.anomaly.risk_score ?? 0,
      (systemState?.ai.latest_risk_score ?? 0) / 100,
      (guardianState?.last_risk_score ?? 0) / 100,
    ) * 100,
  );
  const attackDetected =
    protocolPaused ||
    Boolean(guardianState?.active) ||
    riskScore >= 70 ||
    latestEvent?.decision.action === "pause" ||
    latestEvent?.decision.action === "hedge" ||
    latestAiResult?.decision.action === "pause" ||
    latestAiResult?.decision.action === "hedge";

  return {
    threatLabel: attackDetected ? "ATTACK" : "SAFE",
    threatTone: attackDetected ? "danger" : "primary",
    riskScore,
    protocolStatus: systemState
      ? protocolPaused
        ? "PAUSED"
        : "LIVE"
      : "OFFLINE",
    decisionLabel:
      latestEvent?.decision.action?.toUpperCase() ??
      latestAiResult?.decision.action?.toUpperCase() ??
      "MONITORING",
  };
}
