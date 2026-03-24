import { cn } from "@/lib/utils";

type StatusPillProps = {
  label: string;
  tone?: "primary" | "warning" | "danger" | "muted";
};

const toneStyles = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-yellow-400/20 text-yellow-400",
  danger: "bg-tertiary-container/20 text-tertiary",
  muted: "bg-surface-container-highest text-on-surface-variant",
};

const dotStyles = {
  primary: "bg-primary",
  warning: "bg-yellow-400",
  danger: "bg-tertiary",
  muted: "bg-on-surface-variant",
};

export function StatusPill({
  label,
  tone = "primary",
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
        toneStyles[tone],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotStyles[tone])} />
      {label}
    </span>
  );
}
