"use client";

import { motion } from "framer-motion";

import { MaterialIcon } from "@/components/ui/material-icon";
import { workflowSteps } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const toneStyles = {
  primary: {
    tag: "border-primary/20 text-primary",
    card: "border-primary/20 hover:border-primary",
    icon: "bg-primary/10 text-primary",
    title: "text-primary",
    line: "from-primary to-surface-variant",
  },
  secondary: {
    tag: "border-secondary/20 text-secondary",
    card: "border-secondary/20 hover:border-secondary",
    icon: "bg-secondary/10 text-secondary",
    title: "text-secondary",
    line: "from-secondary to-tertiary",
  },
  tertiary: {
    tag: "border-tertiary-container/20 text-tertiary-container",
    card: "border-tertiary-container/40 hover:border-tertiary-container",
    icon: "bg-tertiary-container/10 text-tertiary-container",
    title: "text-tertiary-container",
    line: "from-tertiary-container to-tertiary",
  },
};

export function WorkflowNodeCanvas() {
  return (
    <section className="workflow-dot-grid flex-1 overflow-auto p-8 md:p-12">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-12">
        {workflowSteps.map((step, index) => {
          const tone = toneStyles[step.tone];

          return (
            <div key={step.title} className="relative w-full max-w-md">
              <div
                className={cn(
                  "absolute -top-3 left-6 z-10 border bg-surface px-2 font-headline text-[10px] font-bold tracking-tight",
                  tone.tag,
                )}
              >
                {step.label}
              </div>

              <motion.article
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "relative rounded-sm border bg-surface-container-high p-6 shadow-panel transition-all",
                  tone.card,
                  step.tone === "tertiary" && "animate-float",
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn("rounded-sm p-3", tone.icon)}>
                    <MaterialIcon icon={step.icon} filled={step.tone === "tertiary"} />
                  </div>

                  <div className="flex-1">
                    <h3 className={cn("font-headline font-bold", tone.title)}>{step.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                      {step.description}
                    </p>

                    {"tags" in step && step.tags ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {step.tags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-surface-container-highest px-2 py-1 font-mono text-[10px] text-primary"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {"actions" in step && step.actions ? (
                      <div className="mt-3 space-y-2">
                        {step.actions.map((action) => (
                          <div
                            key={action}
                            className="flex items-center gap-2 rounded-sm border border-tertiary-container/10 bg-tertiary-container/5 p-2"
                          >
                            <MaterialIcon icon="chevron_right" className="text-xs text-tertiary-container" />
                            <span className="text-[10px] font-bold uppercase tracking-tight">
                              {action}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.article>

              {index < workflowSteps.length - 1 ? (
                <div className={cn("mx-auto h-12 w-px bg-gradient-to-b", tone.line)} />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
