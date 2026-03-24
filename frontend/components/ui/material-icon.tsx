import { cn } from "@/lib/utils";

type MaterialIconProps = {
  icon: string;
  className?: string;
  filled?: boolean;
};

export function MaterialIcon({
  icon,
  className,
  filled = false,
}: MaterialIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("material-symbols-outlined", filled && "filled", className)}
    >
      {icon}
    </span>
  );
}
