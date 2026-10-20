"use client";

import { useMemo, useState } from "react";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { MoveSequence } from "@/components/algs/move-sequence";
import { ScrambleNet } from "@/components/timer/scramble-net";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { countMoves } from "@/lib/fmc";
import { faceTurnsOnly, invertAlg, mirrorAlg, simplifyAlg } from "@/lib/notation";
import { describeAlg } from "@/lib/triggers";

type Row = { label: string; hint: string; alg: string };

export function AlgView() {
  const [alg, setAlg] = useState("R U R' U' R' F R2 U' R' U' R U R' F'");

  const result = useMemo(() => {
    if (!alg.trim()) return null;
    try {
      const rows: Row[] = [
        { label: "Inverse", hint: "Undoes it. Doing this sets up the case your algorithm solves.", alg: invertAlg(alg) },
        { label: "Mirror left-right", hint: "For the mirrored case: R and L swap, every turn reverses.", alg: mirrorAlg(alg, "M") },
        { label: "Mirror front-right", hint: "Reflected through the front-right edge, for F2L cases in the same slot.", alg: mirrorAlg(alg, "FR") },
        { label: "Cleaned up", hint: "Neighbouring turns of the same layer merged.", alg: simplifyAlg(alg) },
        { label: "Face turns only", hint: "Wide, slice and rotation moves rewritten as outer turns, cube held still.", alg: faceTurnsOnly(alg) },
      ];
      return { rows, counts: countMoves(alg), describe: describeAlg(alg) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [alg]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="alg-input" className="text-sm font-medium">
          Algorithm (3x3)
        </label>
        <Textarea id="alg-input" value={alg} onChange={(e) => setAlg(e.target.value)} rows={2} spellCheck={false} className="font-mono text-lg" />
        {result && "error" in result && <p className="text-sm text-missed">{result.error}</p>}
      </div>

      {result && "rows" in result && result.rows && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["HTM", result.counts.htm, "Half turns count 1, slices 2"],
                ["STM", result.counts.stm, "Slices count 1"],
                ["QTM", result.counts.qtm, "Half turns count 2"],
                ["ETM", result.counts.etm, "Rotations count too"],
              ] as const
            ).map(([label, value, hint]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-3" title={hint}>
                <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                <dd className="text-2xl font-extrabold tabular-nums">{value}</dd>
                <dd className="text-xs text-muted-foreground">{hint}</dd>
              </div>
            ))}
          </dl>
          {result.describe.length > 1 && (
            <ul className="flex flex-wrap gap-1.5">
              {result.describe.slice(1).map((tag) => (
                <li key={tag} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {tag}
                </li>
              ))}
            </ul>
          )}

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
              {result.rows.map((row) => (
                <li key={row.label} className="flex flex-col gap-1.5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{row.label}</p>
                      <p className="text-xs text-muted-foreground">{row.hint}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Copy ${row.label.toLowerCase()}`}
                      className="shrink-0 text-muted-foreground"
                      onClick={() => navigator.clipboard.writeText(row.alg).then(() => toast("Copied"))}
                    >
                      <CopyIcon />
                    </Button>
                  </div>
                  {row.alg ? <MoveSequence alg={row.alg} className="text-lg" /> : <p className="text-sm text-muted-foreground">Nothing left: it cancels out.</p>}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">What it does to a solved cube</p>
              <ScrambleNet scramble={alg} className="w-full max-w-64" />
              <p className="text-xs text-muted-foreground">White top, green front.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
