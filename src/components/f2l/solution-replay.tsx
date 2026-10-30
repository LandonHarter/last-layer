"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyAlg, solvedCube } from "@/lib/cube";
import { tokens } from "@/lib/notation";
import { type F2LExercise } from "@/lib/f2l-trainer";
import { cn } from "@/lib/utils";
import { F2LCubeState } from "./cube-state";

export function F2LSolutionReplay({ exercise, alg }: { exercise: F2LExercise; alg: string }) {
  const [step, setStep] = useState(0);
  const moves = tokens(alg);
  const state = useMemo(() => applyAlg(solvedCube(), `${exercise.setup} ${tokens(alg).slice(0, step).join(" ")}`), [exercise.setup, alg, step]);
  return (
    <div className="flex flex-col gap-3">
      <F2LCubeState state={state} slot={exercise.slot} />
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" aria-label="Reset replay" disabled={step === 0} onClick={() => setStep(0)}><RotateCcwIcon /></Button>
        <Button variant="outline" size="icon" aria-label="Previous move" disabled={step === 0} onClick={() => setStep(step - 1)}><ChevronLeftIcon /></Button>
        <span className="min-w-24 text-center text-sm tabular-nums" aria-live="polite">{step} / {moves.length} moves</span>
        <Button variant="outline" size="icon" aria-label="Next move" disabled={step === moves.length} onClick={() => setStep(step + 1)}><ChevronRightIcon /></Button>
      </div>
      <div className="flex flex-wrap justify-center gap-1" aria-label="Replay moves">
        {moves.map((move, i) => (
          <button key={i} type="button" aria-label={`Show state after move ${i + 1}: ${move}`} aria-current={step === i + 1 ? "step" : undefined}
            onClick={() => setStep(i + 1)} className={cn("rounded px-1.5 py-1 font-mono text-sm focus-visible:outline-2 focus-visible:outline-ring", step === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
            {move}
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Dots follow your target pair. Replay starts from the setup.</p>
    </div>
  );
}
