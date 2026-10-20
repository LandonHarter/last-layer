"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckIcon, PlayIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { MoveSequence } from "@/components/algs/move-sequence";
import { ScrambleNet } from "@/components/timer/scramble-net";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { checkSolution, padScramble } from "@/lib/fmc";
import { invertAlg } from "@/lib/notation";
import { createStore } from "@/lib/store";
import { useSolver } from "@/lib/use-solver";
import { cn } from "@/lib/utils";

type Attempt = { scramble: string; solution: string; moves: number; ms: number; at: number };
const store = createStore<{ attempts: Attempt[] }>("last-layer:fmc:v1", { attempts: [] });

const HOUR = 60 * 60 * 1000;

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function FmcView() {
  const { scramble: randomState, solve, busy } = useSolver();
  const { attempts } = store.use();
  const [scramble, setScramble] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [solution, setSolution] = useState("");
  const [inverse, setInverse] = useState(false);
  const [done, setDone] = useState<Attempt | null>(null);
  const [computer, setComputer] = useState<string | null>(null);

  const newScramble = useCallback(async () => {
    setScramble("");
    setStartedAt(null);
    setSolution("");
    setDone(null);
    setComputer(null);
    setInverse(false);
    try {
      // Rarely the padding would merge with the first or last turn; draw again.
      for (let i = 0; i < 10; i++) {
        const padded = padScramble(await randomState());
        if (padded) return setScramble(padded);
      }
    } catch (e) {
      toast(`Couldn't make a scramble: ${e instanceof Error ? e.message : e}`);
    }
  }, [randomState]);
  useEffect(() => {
    newScramble();
  }, [newScramble]);

  useEffect(() => {
    if (startedAt === null || done) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt, done]);

  const check = useMemo(() => (scramble && solution.trim() ? checkSolution(scramble, solution) : null), [scramble, solution]);
  const left = startedAt === null ? HOUR : HOUR - (now - startedAt);

  function submit() {
    if (!check?.ok || !check.solved) return;
    const attempt = { scramble, solution: solution.trim(), moves: check.moves, ms: startedAt === null ? 0 : Date.now() - startedAt, at: Date.now() };
    store.update((d) => ({ attempts: [...d.attempts, attempt] }));
    setDone(attempt);
  }

  const best = attempts.length ? Math.min(...attempts.map((a) => a.moves)) : null;
  const mean = attempts.length ? attempts.reduce((s, a) => s + a.moves, 0) / attempts.length : null;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex flex-col gap-5">
        <section aria-label="Scramble" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={cn("font-clock text-5xl tabular-nums", left <= 0 ? "text-missed" : left < 5 * 60 * 1000 ? "text-learning" : "text-foreground")}>
              {left <= 0 ? "Time's up" : clock(left)}
            </span>
            <div className="flex flex-wrap gap-2">
              {startedAt === null && scramble && (
                <Button
                  onClick={() => {
                    setStartedAt(Date.now());
                    setNow(Date.now());
                  }}
                >
                  <PlayIcon data-icon="inline-start" />
                  Start the hour
                </Button>
              )}
              <Button variant="outline" onClick={newScramble} disabled={busy && !scramble}>
                <RefreshCwIcon data-icon="inline-start" />
                New scramble
              </Button>
            </div>
          </div>
          {!scramble ? (
            <p className="text-sm text-muted-foreground">Making a random-state scramble…</p>
          ) : (
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <div className="flex flex-1 flex-col gap-2">
                <MoveSequence alg={inverse ? invertAlg(scramble) : scramble} className="text-[clamp(1.05rem,2vw,1.4rem)] leading-snug" />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={inverse} onChange={(e) => setInverse(e.target.checked)} className="size-4 accent-primary" />
                  Show the inverse scramble (for NISS)
                </label>
              </div>
              <ScrambleNet scramble={inverse ? invertAlg(scramble) : scramble} className="w-40 shrink-0" />
            </div>
          )}
        </section>

        <section aria-labelledby="fmc-solution" className="flex flex-col gap-3">
          <label id="fmc-solution" htmlFor="fmc-solution-input" className="text-sm font-medium">
            Your solution
          </label>
          <Textarea
            id="fmc-solution-input"
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            readOnly={!!done}
            rows={4}
            spellCheck={false}
            placeholder="Face turns, wide turns and rotations. Brackets and comments in ( ) are fine."
            className="font-mono text-base"
          />
          <div className="flex min-h-8 flex-wrap items-center gap-3 text-sm">
            {check && !check.ok && <span className="text-missed">{check.error}</span>}
            {check?.ok && (
              <>
                <span className="font-semibold tabular-nums">{check.moves} moves</span>
                <span className={check.solved ? "text-learned" : "text-muted-foreground"}>{check.solved ? "Solves it" : "Doesn't solve it yet"}</span>
                {check.slices && <span className="text-missed">Slice moves aren&apos;t allowed in official FMC (each counts as 2 here).</span>}
              </>
            )}
            {!done && (
              <Button size="sm" className="ml-auto" disabled={!check?.ok || !check.solved} onClick={submit}>
                <CheckIcon data-icon="inline-start" />
                Submit
              </Button>
            )}
          </div>
        </section>

        {done && (
          <section aria-label="Result" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
            <p className="text-lg">
              <span className="font-extrabold">{done.moves} moves</span>
              {done.ms > 0 && <span className="text-muted-foreground"> in {clock(done.ms)}</span>}
              {best !== null && done.moves <= best && attempts.length > 1 && <span className="text-learned"> · your best</span>}
            </p>
            {computer === null ? (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  solve(scramble)
                    .then(setComputer)
                    .catch((e) => toast(String(e)))
                }
                disabled={busy}
              >
                Show a computer solution
              </Button>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Two-phase solver, {computer.split(" ").filter(Boolean).length} moves (not optimal):</span>
                <MoveSequence alg={computer} className="text-base" />
              </div>
            )}
          </section>
        )}
      </div>

      <aside aria-label="Your attempts" className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold tracking-tight">Your attempts</h2>
        {attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Solve a scramble and submit it to start a record.</p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Best", best],
                ["Mean", mean?.toFixed(2)],
                ["Count", attempts.length],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-lg border border-border bg-card p-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-bold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <ol className="flex max-h-96 flex-col overflow-y-auto text-sm">
              {[...attempts].reverse().map((a) => (
                <li key={a.at} className="flex items-baseline justify-between gap-3 border-b border-border py-1.5" title={a.solution}>
                  <span className="text-muted-foreground">{new Date(a.at).toLocaleDateString()}</span>
                  <span className="font-bold tabular-nums">{a.moves}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </aside>
    </div>
  );
}
