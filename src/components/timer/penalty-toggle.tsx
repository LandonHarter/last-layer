"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { setPenalty, type Penalty, type Solve } from "@/lib/solves";

const ITEM = "px-2.5 aria-pressed:bg-foreground aria-pressed:text-background";

export function PenaltyToggle({ solve, className }: { solve: Solve; className?: string }) {
  return (
    <ToggleGroup
      value={[solve.penalty]}
      onValueChange={(v) => v[0] && setPenalty(solve.id, v[0] as Penalty)}
      variant="outline"
      size="sm"
      spacing={0}
      aria-label="Penalty"
      className={className}
    >
      <ToggleGroupItem value="none" className={ITEM}>
        OK
      </ToggleGroupItem>
      <ToggleGroupItem value="+2" className={ITEM}>
        +2
      </ToggleGroupItem>
      <ToggleGroupItem value="dnf" className={ITEM}>
        DNF
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
