"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MoveSequence } from "@/components/algs/move-sequence";
import { CasePicker } from "@/components/timer/case-picker";
import { PenaltyToggle } from "@/components/timer/penalty-toggle";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMs, formatSolve, type Solve } from "@/lib/solves";
import { rollingAverage } from "@/lib/stats";

const SHOWN = 200;

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Newest-first list of a session's solves. Each row opens its details. */
export function SolveList({ solves, times, onDelete }: { solves: Solve[]; times: number[]; onDelete: (s: Solve) => void }) {
  const ao5 = useMemo(() => rollingAverage(times, 5), [times]);
  const rows = solves.map((s, i) => ({ solve: s, index: i + 1, ao5: ao5[i] })).slice(-SHOWN).reverse();

  return (
    <section aria-labelledby="solves-heading" className="flex min-h-0 flex-1 flex-col gap-2">
      <h2 id="solves-heading" className="text-base font-extrabold tracking-tight">
        Solves
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your solves show up here. Each one keeps its scramble.</p>
      ) : (
        <ol className="-mx-2 min-h-0 flex-1 overflow-y-auto text-sm tabular-nums">
          {rows.map(({ solve, index, ao5 }) => (
            <li key={solve.id}>
              <Popover>
                <PopoverTrigger className="grid w-full grid-cols-[3rem_1fr_1fr] items-baseline rounded-md px-2 py-1 text-left hover:bg-muted">
                  <span className="text-muted-foreground">{index}</span>
                  <span className={solve.penalty === "dnf" ? "font-semibold text-missed" : "font-semibold"}>{formatSolve(solve)}</span>
                  <span className="text-right text-muted-foreground">{ao5 === null ? "" : formatMs(ao5)}</span>
                </PopoverTrigger>
                <PopoverContent side="left" align="start" className="w-80 gap-3 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-clock text-4xl">{formatSolve(solve)}</span>
                    <span className="text-xs text-muted-foreground">Solve {index}</span>
                  </div>
                  <MoveSequence alg={solve.scramble} className="text-sm leading-snug" />
                  <p className="text-xs text-muted-foreground">
                    {dateFormat.format(solve.at)}
                    {solve.inspectionMs !== undefined && `. Inspection ${formatMs(solve.inspectionMs, 1)} s`}
                  </p>
                  <div className="-ml-2.5 flex items-center gap-1">
                    <CasePicker solve={solve} step="oll" />
                    <CasePicker solve={solve} step="pll" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <PenaltyToggle solve={solve} />
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-missed" onClick={() => onDelete(solve)}>
                      Delete
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </li>
          ))}
        </ol>
      )}
      {solves.length > SHOWN && (
        <p className="text-xs text-muted-foreground">
          Showing your latest {SHOWN}.{" "}
          <Link href="/analyze" className="underline underline-offset-4 hover:text-foreground">
            See all in Analyze
          </Link>
        </p>
      )}
    </section>
  );
}
