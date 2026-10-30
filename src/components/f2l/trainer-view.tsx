"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, ChevronLeftIcon, LightbulbIcon, PlayIcon } from "lucide-react";
import { MoveSequence } from "@/components/algs/move-sequence";
import { PageIntro } from "@/components/page-intro";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { applyAlg, solvedCube } from "@/lib/cube";
import {
  F2L_CASES, F2L_SLOTS, SLOT_INFO, checkF2LSolution, describeF2LSolution, f2lComparisons,
  f2lVariantKey, f2lVariants, makeF2LExercise, pickF2LVariant,
  type F2LCheck, type F2LExercise, type F2LSlot, type F2LSolution,
} from "@/lib/f2l-trainer";
import { getF2LProgress, saveF2LAttempt, saveF2LBest, useF2LProgress } from "@/lib/f2l-progress";
import { countMoves } from "@/lib/fmc";
import { simplifyAlg } from "@/lib/notation";
import { createStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { F2LCubeState } from "./cube-state";
import { F2LSolutionReplay } from "./solution-replay";

type Settings = { scope: string; slots: F2LSlot[]; mirrors: boolean };
const settingsStore = createStore<Settings>("last-layer:f2l-lab-settings:v1", { scope: "all", slots: [...F2L_SLOTS], mirrors: true });
const GROUPS = [...new Set(F2L_CASES.map((c) => c.group))];
const selectClass = "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";

function casesFor(scope: string) {
  if (scope === "inserts") return F2L_CASES.filter((c) => Number(c.id.split("-")[1]) <= 4);
  if (scope.startsWith("group:")) return F2L_CASES.filter((c) => c.group === scope.slice(6));
  if (scope.startsWith("f2l-")) return F2L_CASES.filter((c) => c.id === scope);
  return F2L_CASES;
}

export function F2LTrainerView() {
  const settings = settingsStore.use();
  const progress = useF2LProgress();
  const [session, setSession] = useState<{ exercise: F2LExercise; number: number } | null>(null);
  const variants = useMemo(() => f2lVariants(casesFor(settings.scope).map((c) => c.id), settings.slots, settings.mirrors), [settings.scope, settings.slots, settings.mirrors]);
  const records = variants.flatMap((v) => progress[f2lVariantKey(v)] ? [progress[f2lVariantKey(v)]] : []);
  const attempts = records.reduce((sum, r) => sum + r.attempts, 0);
  const efficient = records.reduce((sum, r) => sum + r.efficient, 0);
  const solid = records.filter((r) => r.streak >= 3).length;

  function next() {
    const variant = pickF2LVariant(variants, getF2LProgress(), session ? f2lVariantKey(session.exercise) : undefined);
    if (variant) setSession({ exercise: makeF2LExercise(variant), number: (session?.number ?? 0) + 1 });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-6 sm:px-6 md:py-12">
      <div>
        <Link href="/drill" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"><ChevronLeftIcon className="size-4" />Drill</Link>
        <h1 className="mt-2 text-[2rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl">Find a better F2L solution</h1>
        <PageIntro>Practice every slot, not just front-right. Solve the target pair on your cube, enter your moves, then compare verified alternatives. Keep the cross and other three slots solved. Weak variants return sooner; three unassisted first attempts within the move and rotation target make a variant solid.</PageIntro>
      </div>

      {session ? (
        <F2LSession key={session.number} exercise={session.exercise} number={session.number} onNext={next} onEnd={() => setSession(null)} />
      ) : (
        <>
          <section aria-label="Practice settings" className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold">Cases
                <select className={selectClass} value={settings.scope} onChange={(e) => settingsStore.write({ ...settings, scope: e.target.value })}>
                  <option value="all">All 41 cases</option>
                  <option value="inserts">Start simple: insertions (1–4)</option>
                  <optgroup label="Case families">{GROUPS.map((g) => <option key={g} value={`group:${g}`}>{g}</option>)}</optgroup>
                  <optgroup label="One case">{F2L_CASES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                </select>
              </label>
              <fieldset className="min-w-0">
                <legend className="mb-2 text-sm font-semibold">Slots</legend>
                <div className="grid grid-cols-2 gap-2">
                  {F2L_SLOTS.map((slot) => (
                    <label key={slot} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <input type="checkbox" checked={settings.slots.includes(slot)} className="size-4 accent-primary"
                        onChange={(e) => { const slots = F2L_SLOTS.filter((s) => s === slot ? e.target.checked : settings.slots.includes(s)); if (slots.length) settingsStore.write({ ...settings, slots: [...slots] }); }} />
                      {SLOT_INFO[slot].label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.mirrors} onChange={(e) => settingsStore.write({ ...settings, mirrors: e.target.checked })} className="size-4 accent-primary" />Mix in mirrored cases</label>
            <p className="text-sm text-muted-foreground">New to F2L? Start with insertions and the two front slots. Plan before turning; chase fewer moves first, then comfortable execution. Every exercise varies the U position.</p>
            <Button size="lg" onClick={next} className="h-12 text-base font-bold">Start practice<ArrowRightIcon /></Button>
          </section>

          <section aria-labelledby="f2l-progress" className="flex flex-col gap-4">
            <h2 id="f2l-progress" className="text-xl font-bold">Your efficiency</h2>
            <dl className="grid grid-cols-3 gap-3">
              {[["First attempts", attempts], ["Within target", efficient], ["Solid variants", solid]].map(([label, value]) => <div key={label} className="rounded-lg bg-muted p-3 sm:p-4"><dt className="text-xs text-muted-foreground sm:text-sm">{label}</dt><dd className="mt-1 text-3xl font-extrabold tabular-nums">{value}</dd></div>)}
            </dl>
            <p className="text-sm text-muted-foreground">For your selected cases and slots. A variant is one case, slot, mirror choice and U position. Only the first check counts; retries help you learn without inflating your score.</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground"><tr><th className="p-3 font-medium">Slot</th><th className="p-3 font-medium">Checked</th><th className="p-3 font-medium">Within target</th></tr></thead>
                <tbody>{settings.slots.map((slot) => {
                  const own = variants.filter((v) => v.slot === slot).flatMap((v) => progress[f2lVariantKey(v)] ? [progress[f2lVariantKey(v)]] : []);
                  const count = own.reduce((sum, r) => sum + r.attempts, 0);
                  const hits = own.reduce((sum, r) => sum + r.efficient, 0);
                  return <tr key={slot} className="border-t border-border"><th className="p-3 font-medium">{SLOT_INFO[slot].label}</th><td className="p-3 tabular-nums">{count}</td><td className="p-3 tabular-nums">{count ? `${Math.round(hits / count * 100)}%` : "—"}</td></tr>;
                })}</tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function F2LSession({ exercise, number, onNext, onEnd }: { exercise: F2LExercise; number: number; onNext: () => void; onEnd: () => void }) {
  const progress = useF2LProgress();
  const [comparisons] = useState(() => f2lComparisons(exercise, getF2LProgress()[f2lVariantKey(exercise)]?.best?.alg));
  const target = comparisons[0];
  const c = F2L_CASES.find((c) => c.id === exercise.caseId)!;
  const [input, setInput] = useState("");
  const [result, setResult] = useState<F2LCheck | null>(null);
  const [hint, setHint] = useState(false);
  const [showSolutions, setShowSolutions] = useState(false);
  const [replay, setReplay] = useState<string | null>(null);
  const recorded = useRef(false);
  const assisted = useRef(false);
  const start = useMemo(() => applyAlg(solvedCube(), exercise.setup), [exercise.setup]);
  const counts = useMemo(() => { try { return describeF2LSolution(input); } catch { return null; } }, [input]);
  const streak = progress[f2lVariantKey(exercise)]?.streak ?? 0;
  const displaySolutions = [...comparisons.filter((s) => s.rotations === 0).slice(0, 3), ...comparisons.filter((s) => s.rotations > 0).slice(0, 1)];

  function record(check: F2LCheck | null) {
    if (!recorded.current) {
      saveF2LAttempt(exercise, check, target, assisted.current);
      recorded.current = true;
    } else if (check) saveF2LBest(exercise, check);
  }

  function submit() {
    const check = checkF2LSolution(exercise, input);
    setResult(check);
    if (!check.ok) return;
    record(check);
    if (check.solved) setShowSolutions(true);
  }

  function reveal() {
    assisted.current = true;
    record(null);
    setShowSolutions(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="font-semibold">Exercise {number} · {SLOT_INFO[exercise.slot].label}<span className="ml-2 font-normal text-muted-foreground">{Math.min(3, streak)} / 3 clean recalls</span></p>
        <Button variant="ghost" onClick={onEnd}>End practice</Button>
      </div>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-label="Exercise cube" className="min-w-0 rounded-xl border border-border bg-card p-4 md:sticky md:top-20">
          {replay ? <F2LSolutionReplay key={replay} exercise={exercise} alg={replay} /> : <>
            <F2LCubeState state={start} slot={exercise.slot} />
            <p className="mt-2 text-center text-xs text-muted-foreground">Dots mark your target corner and edge, including hidden faces.</p>
          </>}
          {replay && <Button variant="ghost" className="mt-3 w-full" onClick={() => setReplay(null)}>Back to starting state</Button>}
          <p className="mt-4 text-sm font-semibold">Solve the {SLOT_INFO[exercise.slot].label.toLowerCase()} pair.</p>
          <p className="mt-1 text-sm text-muted-foreground">Finish with the cross and all other slots restored. Cube rotations are allowed.</p>
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="f2l-setup" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
            <h2 id="f2l-setup" className="text-sm font-semibold">Set up from solved</h2>
            <p className="text-sm text-muted-foreground">U on top, F in front. Standard scheme: yellow up, green front, white cross down. Diagram uses your theme&apos;s colors.</p>
            <MoveSequence alg={exercise.setup} className="text-[clamp(1.05rem,2vw,1.5rem)]" />
          </section>

          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <label htmlFor="f2l-answer" className="text-sm font-semibold">Your solution</label>
            <p id="f2l-answer-help" className="text-sm text-muted-foreground">Plan it, try it, then enter every move you used—including U adjustments and rotations. Any valid solution is accepted.</p>
            <Textarea id="f2l-answer" value={input} onChange={(e) => { setInput(e.target.value); setResult(null); }} aria-describedby="f2l-answer-help" aria-invalid={result?.ok === false} rows={3} spellCheck={false} autoCapitalize="off" autoCorrect="off" maxLength={2000} placeholder="R U R' …" className="font-mono text-base" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm tabular-nums text-muted-foreground">{counts ? `${counts.htm} HTM · ${counts.rotations} rotations` : "HTM: a half turn counts as one move"}</span>
              <Button type="submit">{recorded.current ? "Check again" : "Check solution"}</Button>
            </div>
          </form>

          <div aria-live="polite" aria-atomic="true">
            {result && !result.ok && <p className="text-sm text-missed">{result.error}</p>}
            {result?.ok && <SolutionFeedback result={result} target={target} onReplay={() => setReplay(result.alg)} />}
          </div>
          {recorded.current && <p className="text-xs text-muted-foreground">First attempt recorded. Retry freely: better solutions are saved, but retries don&apos;t add to your clean streak.</p>}

          <div className="flex flex-wrap gap-2">
            {!hint && !showSolutions && <Button variant="outline" onClick={() => { assisted.current = true; setHint(true); }}><LightbulbIcon />Give me a hint</Button>}
            {!showSolutions && <Button variant="outline" onClick={reveal}>Show solutions{!recorded.current && " (assisted)"}</Button>}
          </div>
          {hint && <div className="rounded-lg bg-muted p-4 text-sm leading-relaxed"><p className="font-semibold">{c.group}{exercise.mirrored ? " · mirrored" : ""}</p><p className="mt-1">Locate both dotted pieces. Trace where the edge must meet the corner, then look for an insertion into {SLOT_INFO[exercise.slot].label.toLowerCase()}. Try pairing in U without extracting pieces already in a useful position.</p><p className="mt-2 text-muted-foreground">Move target: {target.htm} HTM, {target.rotations} rotations. Hint used; this attempt won&apos;t build a clean streak.</p></div>}

          {showSolutions && (
            <section aria-labelledby="f2l-alternatives" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
              <div><h2 id="f2l-alternatives" className="text-lg font-bold">Compare solutions</h2><p className="mt-1 text-sm text-muted-foreground">{c.name}{exercise.mirrored ? " · mirrored within its slot" : ""} · {c.group}</p></div>
              <p className="text-sm text-muted-foreground">Best known here: {target.htm} HTM, {target.rotations} rotations. Verified against this exact setup; shortest possible is not proven. Slot variants are mechanically transformed—try them on your cube to judge comfort.</p>
              {displaySolutions.map((s) => <div key={s.alg} className="flex flex-col gap-2 border-t border-border pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold tabular-nums">{s.htm} HTM · {s.rotations} {s.rotations === 1 ? "rotation" : "rotations"}</span><Button variant="outline" size="sm" onClick={() => setReplay(s.alg)}><PlayIcon />Step through</Button></div>
                <MoveSequence alg={s.alg} className="text-lg" />
              </div>)}
              <p className="text-sm text-muted-foreground">Before moving on: explain where pairing ends and insertion begins. Reset with the setup, then repeat your preferred solution slowly without pausing. Fewer moves helps; comfortable, consistent execution matters too.</p>
            </section>
          )}

          <Button size="lg" className="h-11 w-full" onClick={() => { if (!recorded.current) { assisted.current = true; record(null); } onNext(); }}>{recorded.current ? "Next exercise" : "Skip exercise"}<ArrowRightIcon /></Button>
        </div>
      </div>
    </div>
  );
}

function SolutionFeedback({ result, target, onReplay }: { result: Extract<F2LCheck, { ok: true }>; target: F2LSolution; onReplay: () => void }) {
  const gap = result.htm - target.htm;
  const within = result.solved && gap <= 0 && result.rotations <= target.rotations;
  const cleaned = simplifyAlg(result.alg);
  const saved = result.htm - countMoves(cleaned).htm;
  return (
    <section aria-label="Solution feedback" className={cn("flex flex-col gap-3 rounded-lg border p-4", within ? "border-learned/40 bg-learned/10" : "border-border bg-muted")}>
      <h2 className={cn("text-lg font-bold", result.solved ? "text-learned" : "text-missed")}>{!result.solved ? "Not solved yet" : within ? "Solved within target" : "Solved—now make it more efficient"}</h2>
      <ul className="space-y-1 text-sm">
        <li>{result.targetSolved ? "Target pair solved." : "Target pair still needs work."}</li>
        <li>{result.crossSolved ? "Cross preserved." : "Cross was broken—restore it by the end."}</li>
        <li>{result.brokenSlots.length ? `Restore these slots: ${result.brokenSlots.map((slot) => SLOT_INFO[slot].label.toLowerCase()).join(", ")}.` : "Other three slots preserved."}</li>
      </ul>
      {result.solved && <p className="text-sm">{result.htm} HTM · {result.rotations} rotations. {gap > 0 ? `${gap} moves above the ${target.htm}-HTM reference. Compare its setup and insertion with yours.` : gap < 0 ? `You beat the reference by ${-gap} HTM. Your solution is saved for this variant.` : "You matched the reference move count."} {result.rotations > target.rotations && "Try the rotation-free alternative, then compare how each feels."}</p>}
      {saved > 0 && <p className="text-sm">Adjacent turns cancel or merge: rewriting them saves {saved} HTM. Your entered moves still count toward this attempt.</p>}
      <Button variant="outline" className="self-start" onClick={onReplay}><PlayIcon />Inspect your moves</Button>
    </section>
  );
}
