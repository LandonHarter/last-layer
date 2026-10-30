"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setLabel, setsOf, type AlgSet, type Puzzle } from "@/lib/puzzles";

/** A compact single-set picker, including puzzles with many advanced sets. */
export function SetSelect({ puzzle, value, onChange, all = false }: {
  puzzle: Puzzle;
  value: AlgSet | "all";
  onChange: (value: AlgSet | "all") => void;
  all?: boolean;
}) {
  const items = [
    ...(all ? [{ value: "all", label: "All sets" }] : []),
    ...setsOf(puzzle).map((set) => ({ value: set, label: setLabel(set) })),
  ];
  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(v as AlgSet | "all")}>
      <SelectTrigger className="h-9 min-w-36" aria-label="Algorithm set"><SelectValue /></SelectTrigger>
      <SelectContent>
        {items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
