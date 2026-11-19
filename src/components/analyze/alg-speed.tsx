"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ALGS_BY_ID, caseLabel } from "@/data/algs";
import { Figures, Panel } from "@/components/analyze/tests";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { splitsOf, type StepName } from "@/lib/smartcube/splits";
import { formatMs, type Solve } from "@/lib/solves";

const TOGGLE_ITEM = "px-2.5 aria-pressed:bg-foreground aria-pressed:text-background";
const STEPS: { name: StepName; label: string }[] = [
  { name: "cross", label: "Cross" },
  { name: "f2l", label: "F2L" },
  { name: "oll", label: "OLL" },
  { name: "pll", label: "PLL" },
];
type Sort = "total" | "recog" | "exec";

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Smart cube solves: average CFOP step times, and for each OLL and PLL you met,
 * how long you took to recognise it and to do it.
 */
export function AlgSpeedSection({ solves }: { solves: Solve[] }) {
  const [sort, setSort] = useState<Sort>("total");
  const recorded = useMemo(() => solves.flatMap((s) => {
    const splits = splitsOf(s);
    return splits ? [{ solve: s, splits }] : [];
  }), [solves]);

  const steps = useMemo(
    () =>
      STEPS.map(({ name, label }) => {
        const done = recorded.flatMap(({ splits }) => splits.steps.filter((st) => st.name === name));
        return { label, total: mean(done.map((st) => st.recogMs + st.execMs)), recog: mean(done.map((st) => st.recogMs)), count: done.length };
      }),
    [recorded],
  );

  const rows = useMemo(() => {
    const by = new Map<string, { recog: number[]; exec: number[]; moves: number }>();
    for (const { solve, splits } of recorded) {
      for (const step of ["oll", "pll"] as const) {
        const id = solve[step];
        const st = splits.steps.find((x) => x.name === step);
        if (!id || !st || st.skipped) continue;
        const row = by.get(id) ?? { recog: [], exec: [], moves: 0 };
        row.recog.push(st.recogMs);
        row.exec.push(st.execMs);
        row.moves += st.moves;
        by.set(id, row);
      }
    }
    const list = [...by].map(([id, r]) => {
      const recog = mean(r.recog)!;
      const exec = mean(r.exec)!;
      const execTotal = r.exec.reduce((a, b) => a + b, 0);
      return { id, alg: ALGS_BY_ID.get(id), count: r.recog.length, recog, exec, total: recog + exec, tps: execTotal ? r.moves / (execTotal / 1000) : null };
    });
    return list.sort((a, b) => b[sort] - a[sort]);
  }, [recorded, sort]);

  if (!recorded.length) return null;

  return (
    <section aria-labelledby="alg-speed" className="flex flex-col gap-4">
      <div>
        <h2 id="alg-speed" className="text-2xl font-extrabold tracking-tight">
          Steps and algorithms
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          From {recorded.length} smart cube {recorded.length === 1 ? "solve" : "solves"}. Recognition is the pause from the step before ending to your first turn;
          execution is from that turn to the step done.
        </p>
      </div>
      <Panel title="Average step times">
        <Figures
          items={steps.map((s) => [s.label, s.total === null ? "–" : `${formatMs(s.total)}${s.recog ? ` (${formatMs(s.recog)} look)` : ""}`] as [string, string])}
        />
      </Panel>
      {rows.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold">OLL and PLL cases</h3>
            <ToggleGroup value={[sort]} onValueChange={(v) => v[0] && setSort(v[0] as Sort)} variant="outline" size="sm" spacing={0} aria-label="Sort cases">
              <ToggleGroupItem value="total" className={TOGGLE_ITEM}>Slowest</ToggleGroupItem>
              <ToggleGroupItem value="recog" className={TOGGLE_ITEM}>Slowest to see</ToggleGroupItem>
              <ToggleGroupItem value="exec" className={TOGGLE_ITEM}>Slowest to do</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[34rem] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-medium">Case</th>
                  <th scope="col" className="px-4 py-2 font-medium">Solves</th>
                  <th scope="col" className="px-4 py-2 font-medium">Recognition</th>
                  <th scope="col" className="px-4 py-2 font-medium">Execution</th>
                  <th scope="col" className="px-4 py-2 font-medium">Total</th>
                  <th scope="col" className="px-4 py-2 font-medium">TPS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-semibold">
                      <Link href={`/algs/${r.id}`} className="underline-offset-4 hover:underline">
                        {r.alg ? caseLabel(r.alg) : r.id}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{r.count}</td>
                    <td className="px-4 py-2">{formatMs(r.recog)}</td>
                    <td className="px-4 py-2">{formatMs(r.exec)}</td>
                    <td className="px-4 py-2 font-semibold">{formatMs(r.total)}</td>
                    <td className="px-4 py-2">{r.tps === null ? "–" : r.tps.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
