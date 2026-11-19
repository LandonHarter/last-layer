"use client";

import { useEffect, useMemo, useState } from "react";
import { CopyIcon, PauseIcon, PlayIcon, SkipBackIcon } from "lucide-react";
import { toast } from "sonner";
import { ALGS_BY_ID } from "@/data/algs";
import { useStickers, WCA_COLOR } from "@/components/timer/scramble-net";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyAlg, colorOf, faceOf, solvedCube, type Face, type Sticker } from "@/lib/cube";
import { decodeMoves } from "@/lib/smartcube/moves";
import { splitsOf, type Step } from "@/lib/smartcube/splits";
import { formatMs, formatSolve, type Solve } from "@/lib/solves";
import { cn } from "@/lib/utils";

const STEP_LABEL: Record<Step["name"], string> = { cross: "Cross", pair: "Pair", f2l: "F2L", oll: "OLL", pll: "PLL" };

/** Step through a smart cube solve: the cube as it was after each turn, its CFOP steps, and a reconstruction to copy. */
export function SolveReplay({ solve, open, onOpenChange }: { solve: Solve; open: boolean; onOpenChange: (open: boolean) => void }) {
  const moves = useMemo(() => decodeMoves(solve.moves), [solve.moves]);
  const splits = splitsOf(solve);
  const states = useMemo(() => {
    let s = applyAlg(solvedCube(), solve.scramble);
    const out = [s];
    for (const m of moves) out.push((s = applyAlg(s, m.move)));
    return out;
  }, [solve.scramble, moves]);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Play back at the speed it was solved.
  useEffect(() => {
    if (!playing) return;
    if (at >= moves.length) return setPlaying(false);
    const wait = at === 0 ? 300 : Math.min(1500, moves[at].t - moves[at - 1].t);
    const timer = window.setTimeout(() => setAt(at + 1), wait);
    return () => window.clearTimeout(timer);
  }, [playing, at, moves]);

  // The steps, each with its pairs before F2L; plus where the replay is.
  const rows = useMemo(() => {
    if (!splits) return [];
    const out: Step[] = [];
    for (const step of splits.steps) {
      if (step.name === "f2l") out.push(...splits.pairs.filter((p) => !p.skipped));
      if (step.name !== "f2l" || !splits.pairs.some((p) => !p.skipped)) out.push(step);
    }
    return out;
  }, [splits]);
  const reconstruction = useMemo(() => {
    const lines = [`${solve.scramble} // scramble`];
    for (const r of rows) {
      const turns = moves.slice(r.first, r.end + 1).map((m) => m.move).join(" ");
      const name = r.name === "oll" && solve.oll ? `OLL (${ALGS_BY_ID.get(solve.oll)?.name})` : r.name === "pll" && solve.pll ? `PLL (${ALGS_BY_ID.get(solve.pll)?.name})` : STEP_LABEL[r.name];
      lines.push(`${turns || "(skip)"} // ${name}${r.skipped ? "" : `, ${formatMs(r.recogMs + r.execMs)} s`}`);
    }
    if (!rows.length) lines.push(moves.map((m) => m.move).join(" "));
    return lines.join("\n");
  }, [rows, moves, solve]);

  const t = at === 0 ? 0 : moves[at - 1].t;
  const current = rows.find((r) => at <= r.end + 1 && at > r.first);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Replay of {formatSolve(solve)}</DialogTitle>
          <DialogDescription>
            {moves.length} turns{solve.ms ? `, ${(moves.length / (solve.ms / 1000)).toFixed(1)} per second` : ""}. Held white up, green front.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <CubeNet state={states[at]} />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-sm" aria-label="Back to the start" onClick={() => (setPlaying(false), setAt(0))}>
                <SkipBackIcon />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={playing ? "Pause" : "Play"}
                onClick={() => {
                  if (!playing && at >= moves.length) setAt(0);
                  setPlaying(!playing);
                }}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </Button>
              <input
                type="range"
                min={0}
                max={moves.length}
                value={at}
                onChange={(e) => (setPlaying(false), setAt(Number(e.target.value)))}
                aria-label="Turn"
                className="min-w-0 flex-1 accent-primary"
              />
              <span className="w-14 text-right text-sm tabular-nums text-muted-foreground">{formatMs(t)}</span>
            </div>
            <p className="min-h-6 font-mono text-sm">
              {at > 0 && (
                <>
                  <span className="text-muted-foreground">{at}.</span> {moves[at - 1].move}
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {rows.length ? (
              <ol className="flex flex-col text-sm tabular-nums">
                {rows.map((r, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => (setPlaying(false), setAt(r.end + 1))}
                      className={cn("grid w-full grid-cols-[3.5rem_1fr_auto] items-baseline gap-2 rounded-md px-2 py-1 text-left hover:bg-muted", current === r && "bg-muted")}
                    >
                      <span className="font-semibold">{STEP_LABEL[r.name]}</span>
                      <span className="text-muted-foreground">
                        {r.skipped ? "Skip" : `${r.moves} turn${r.moves === 1 ? "" : "s"}${r.name === "cross" ? "" : `, ${formatMs(r.recogMs)} look`}`}
                      </span>
                      <span className="font-semibold">{r.skipped ? "" : formatMs(r.recogMs + r.execMs)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No CFOP steps found in this solve.</p>
            )}
            <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">{reconstruction}</pre>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => navigator.clipboard.writeText(reconstruction).then(() => toast("Copied the reconstruction"), () => toast("Couldn't copy"))}
            >
              <CopyIcon data-icon="inline-start" />
              Copy reconstruction
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const LAYOUT: [Face, number, number][] = [["U", 1, 0], ["L", 0, 1], ["F", 1, 1], ["R", 2, 1], ["B", 3, 1], ["D", 1, 2]];

function cell([x, y, z]: Sticker["pos"], face: Face): [number, number] {
  switch (face) {
    case "U": return [x + 1, z + 1];
    case "D": return [x + 1, 1 - z];
    case "F": return [x + 1, 1 - y];
    case "B": return [1 - x, 1 - y];
    case "R": return [1 - z, 1 - y];
    case "L": return [z + 1, 1 - y];
  }
}

/** The cube unfolded, white up and green front, in the theme's colours. */
export function CubeNet({ state, className }: { state: Sticker[]; className?: string }) {
  const stickers = useStickers();
  return (
    <svg viewBox="-0.1 -0.1 13.6 10.3" className={cn("w-full", className)} role="img" aria-label="Cube unfolded: U above F, L on the left, R and B on the right, D below">
      {LAYOUT.map(([face, col, row]) => (
        <g key={face} transform={`translate(${col * 3.4} ${row * 3.4})`}>
          {state
            .filter((s) => faceOf(s.normal) === face)
            .map((s) => {
              const [x, y] = cell(s.pos, face);
              return <rect key={s.id} x={x + 0.04} y={y + 0.04} width={0.92} height={0.92} rx={0.08} fill={stickers[WCA_COLOR[colorOf(s)]]} className="stroke-foreground/30" strokeWidth={0.035} />;
            })}
        </g>
      ))}
    </svg>
  );
}
