"use client";

import { motion } from "framer-motion";

import { useAsyncButtonAction } from "@/hooks/use-async-button-action";
import {
  activateWorkflowRule,
  loadRuntimeSnapshot,
} from "@/lib/button-actions";
import { useUIStore } from "@/store/ui-store";

export function WorkflowEditorHeader() {
  const setSystemState = useUIStore((state) => state.setSystemState);
  const discardAction = useAsyncButtonAction({
    label: "Discard Workflow Draft",
    action: async () => {
      const result = await loadRuntimeSnapshot();
      setSystemState(result.systemState);
      return result;
    },
    getSuccessMessage: () => "Draft reset to live runtime snapshot",
  });
  const deployRuleAction = useAsyncButtonAction({
    label: "Deploy Workflow Rule",
    action: async () => {
      const result = await activateWorkflowRule();
      setSystemState(result.snapshot.systemState);
      return result;
    },
    getSuccessMessage: () => "Monitor rule activated in backend",
  });

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-16 items-center justify-between border-b border-outline-variant/10 bg-surface-container-low px-6 md:px-8"
    >
      <div className="flex items-center gap-4">
        <h1 className="font-headline text-lg font-bold tracking-tight">Flash Loan Mitigation V2</h1>
        <span className="rounded-sm bg-surface-container-highest px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          Draft
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void discardAction.run()}
          disabled={discardAction.isLoading}
          title={discardAction.error ?? discardAction.feedback ?? "Reload live runtime state"}
          className="px-4 py-1.5 font-headline text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant hover:text-on-surface"
        >
          {discardAction.isLoading
            ? "Discarding..."
            : discardAction.isSuccess
              ? "Discarded"
              : discardAction.isError
                ? "Retry Discard"
                : "Discard"}
        </button>
        <button
          type="button"
          onClick={() => void deployRuleAction.run()}
          disabled={deployRuleAction.isLoading}
          title={
            deployRuleAction.error ??
            deployRuleAction.feedback ??
            "Activate the monitor rule through the backend"
          }
          className="rounded-sm bg-primary px-6 py-1.5 font-headline text-xs font-bold uppercase tracking-[0.18em] text-on-primary hover:shadow-glow"
        >
          {deployRuleAction.isLoading
            ? "Deploying..."
            : deployRuleAction.isSuccess
              ? "Rule Live"
              : deployRuleAction.isError
                ? "Retry Deploy"
                : "Deploy Rule"}
        </button>
      </div>
    </motion.section>
  );
}
