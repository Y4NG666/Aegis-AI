import { RawTransactionPanel } from "@/components/threat-center/raw-transaction-panel";
import { RiskConfidencePanel } from "@/components/threat-center/risk-confidence-panel";
import { ThreatAlertBanner } from "@/components/threat-center/threat-alert-banner";
import { ThreatReasoningPanel } from "@/components/threat-center/threat-reasoning-panel";

export default function AiThreatCenterPage() {
  return (
    <div className="flex flex-col gap-10 px-6 py-6 pb-24 md:px-8 lg:px-10">
      <ThreatAlertBanner />

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <RawTransactionPanel />
        </div>
        <div className="space-y-6 lg:col-span-5">
          <RiskConfidencePanel />
          <ThreatReasoningPanel />
        </div>
      </section>
    </div>
  );
}
