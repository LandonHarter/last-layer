"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { setStatus, STATUS_LABELS, type Status } from "@/lib/progress";
import { cn } from "@/lib/utils";

const ACTIVE: Record<Status, string> = {
  unknown: "aria-pressed:bg-secondary aria-pressed:text-secondary-foreground",
  learning: "aria-pressed:bg-learning aria-pressed:text-learning-foreground",
  learned: "aria-pressed:bg-learned aria-pressed:text-learned-foreground",
};

export function StatusToggle({
  id,
  status,
  size = "sm",
  className,
  onChange,
}: {
  id: string;
  status: Status;
  size?: "sm" | "default";
  className?: string;
  onChange?: (status: Status) => void;
}) {
  return (
    <ToggleGroup
      value={[status]}
      onValueChange={(value) => {
        const next = value[0] as Status | undefined;
        if (!next) return;
        setStatus(id, next);
        onChange?.(next);
      }}
      spacing={0}
      variant="outline"
      size={size}
      aria-label="Learning status"
      className={cn("w-full", className)}
    >
      {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
        <ToggleGroupItem
          key={s}
          value={s}
          className={cn("flex-1 px-1.5 font-semibold text-muted-foreground", size === "sm" && "text-[0.72rem]", ACTIVE[s])}
        >
          {STATUS_LABELS[s]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
