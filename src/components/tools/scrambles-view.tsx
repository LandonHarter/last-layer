"use client";

import { useCallback, useEffect, useState } from "react";
import { CopyIcon, PrinterIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { MoveSequence } from "@/components/algs/move-sequence";
import { ScrambleNet } from "@/components/timer/scramble-net";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { scrambleFor, TIMER_PUZZLE_NAMES, TIMER_PUZZLES, type TimerPuzzle } from "@/lib/scramble";
import { useSolver } from "@/lib/use-solver";

const PUZZLE_ITEMS = TIMER_PUZZLES.map((p) => ({ value: p, label: TIMER_PUZZLE_NAMES[p] }));
const COUNTS = ["5", "12", "25", "50"];
const TOGGLE_ITEM = "px-3 font-semibold aria-pressed:bg-foreground aria-pressed:text-background";

export function ScramblesView() {
  const { scramble: randomState } = useSolver();
  const [puzzle, setPuzzle] = useState<TimerPuzzle>("3x3");
  const [count, setCount] = useState(5);
  const [showNets, setShowNets] = useState(true);
  const [scrambles, setScrambles] = useState<string[]>([]);
  const [making, setMaking] = useState(false);

  const make = useCallback(async () => {
    setMaking(true);
    try {
      // 3x3 scrambles are random-state, like the WCA's; other puzzles are random moves.
      const list = puzzle === "3x3" ? await Promise.all(Array.from({ length: count }, () => randomState())) : Array.from({ length: count }, () => scrambleFor(puzzle));
      setScrambles(list);
    } catch (e) {
      toast(`Couldn't make scrambles: ${e instanceof Error ? e.message : e}`);
    } finally {
      setMaking(false);
    }
  }, [puzzle, count, randomState]);
  useEffect(() => {
    make();
  }, [make]);

  const text = scrambles.map((s, i) => `${i + 1}. ${s}`).join("\n");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Puzzle
          <Select items={PUZZLE_ITEMS} value={puzzle} onValueChange={(v) => v && setPuzzle(v as TimerPuzzle)}>
            <SelectTrigger className="w-36" aria-label="Puzzle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {PUZZLE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          How many
          <ToggleGroup value={[String(count)]} onValueChange={(v) => v[0] && setCount(Number(v[0]))} variant="outline" spacing={0} aria-label="How many">
            {COUNTS.map((c) => (
              <ToggleGroupItem key={c} value={c} className={TOGGLE_ITEM}>
                {c}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={make} disabled={making}>
            <RefreshCwIcon data-icon="inline-start" />
            {making ? "Making…" : "New set"}
          </Button>
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(text).then(() => toast(`Copied ${scrambles.length} scrambles`))} disabled={!scrambles.length}>
            <CopyIcon data-icon="inline-start" />
            Copy all
          </Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!scrambles.length}>
            <PrinterIcon data-icon="inline-start" />
            Print
          </Button>
        </div>
        <label className="flex h-8 items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showNets} onChange={(e) => setShowNets(e.target.checked)} className="size-4 accent-primary" />
          Show the scrambled cube
        </label>
      </div>
      <ol className="flex flex-col">
        {scrambles.map((s, i) => (
          <li key={`${i}-${s}`} className="flex items-center gap-4 border-b border-border py-3 break-inside-avoid">
            <span className="w-8 shrink-0 text-right text-lg font-extrabold tabular-nums text-muted-foreground">{i + 1}</span>
            <MoveSequence alg={s} className="flex-1 text-base leading-snug" />
            {showNets && <ScrambleNet scramble={s} puzzle={puzzle} className="hidden w-28 shrink-0 sm:block" />}
          </li>
        ))}
      </ol>
    </div>
  );
}
