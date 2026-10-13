"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { algsOf } from "@/data/algs";
import { PUZZLE_NAMES, PUZZLES, type Puzzle } from "@/lib/puzzles";
import { cn } from "@/lib/utils";

const ITEMS = PUZZLES.map((p) => ({ value: p, label: PUZZLE_NAMES[p] }));

/** Which puzzle's cases a page shows. */
export function PuzzleSelect({
  value,
  onChange,
  className,
}: {
  value: Puzzle;
  onChange: (puzzle: Puzzle) => void;
  className?: string;
}) {
  return (
    <Select items={ITEMS} value={value} onValueChange={(v) => v && onChange(v as Puzzle)}>
      <SelectTrigger className={cn("h-9 min-w-32 font-semibold", className)} aria-label="Puzzle">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            <span className="flex-1">{item.label}</span>
            <span className="ml-3 text-xs text-muted-foreground tabular-nums">{algsOf(item.value).length}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
