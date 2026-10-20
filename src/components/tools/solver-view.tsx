"use client";

import { useState } from "react";
import { CopyIcon, RefreshCwIcon, WandIcon } from "lucide-react";
import { toast } from "sonner";
import { MoveSequence } from "@/components/algs/move-sequence";
import { ScrambleNet } from "@/components/timer/scramble-net";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { checkSolution } from "@/lib/fmc";
import { parseAlg } from "@/lib/notation";
import { randomScramble } from "@/lib/scramble";
import { useSolver } from "@/lib/use-solver";

export function SolverView() {
  const { solve, busy } = useSolver();
  const [scramble, setScramble] = useState("");
  const [result, setResult] = useState<{ scramble: string; solution: string } | null>(null);

  let error: string | null = null;
  try {
    parseAlg(scramble);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  async function run() {
    try {
      const solution = await solve(scramble);
      setResult({ scramble, solution });
    } catch (e) {
      toast(`Couldn't solve it: ${e instanceof Error ? e.message : e}`);
    }
  }

  const verified = result && checkSolution(result.scramble, result.solution);

  return (
    <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_14rem]">
      <div className="flex flex-col gap-5">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!error) run();
          }}
        >
          <label htmlFor="solver-scramble" className="text-sm font-medium">
            Scramble (white top, green front)
          </label>
          <Textarea
            id="solver-scramble"
            value={scramble}
            onChange={(e) => setScramble(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder="R U R' F2 D …  Wide, slice and rotation moves work too."
            className="font-mono text-base"
          />
          {error && scramble.trim() && <p className="text-sm text-missed">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!!error || busy}>
              <WandIcon data-icon="inline-start" />
              {busy ? "Solving…" : "Solve"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setScramble(randomScramble())}>
              <RefreshCwIcon data-icon="inline-start" />
              Random scramble
            </Button>
          </div>
        </form>

        {result && (
          <section aria-label="Solution" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
            {result.solution ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    {result.solution.split(" ").length} moves{verified?.ok && verified.solved ? ", checked on the simulator" : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => navigator.clipboard.writeText(result.solution).then(() => toast("Copied"))}
                  >
                    <CopyIcon data-icon="inline-start" />
                    Copy
                  </Button>
                </div>
                <MoveSequence alg={result.solution} className="text-[clamp(1.2rem,2.6vw,1.75rem)] leading-snug font-bold" />
              </>
            ) : (
              <p>That scramble leaves the cube solved.</p>
            )}
          </section>
        )}
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Solutions come from Kociemba&apos;s two-phase algorithm: always 22 moves or fewer, usually close to the shortest, but not guaranteed optimal.
        </p>
      </div>
      <ScrambleNet scramble={error ? "" : scramble} className="w-full max-w-56" />
    </div>
  );
}
