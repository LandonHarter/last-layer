"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon, EyeIcon, LightbulbIcon, RefreshCwIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { ALGS, ALGS_BY_ID, SETS, type Alg, type AlgSet } from "@/data/algs";
import { CaseImage } from "@/components/algs/case-image";
import { MoveSequence } from "@/components/algs/move-sequence";
import { StatusToggle } from "@/components/algs/status-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Kbd } from "@/components/ui/kbd";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  getLearn,
  learnCase,
  nextTask,
  planBatches,
  recordRecall,
  setCase,
  SOLID,
  updateLearn,
  useLearn,
  type LearnData,
  type Task,
} from "@/lib/learn";
import { moveCount } from "@/lib/notation";
import { allAlgs, entryFor, getProgress, mainAlg, recordAttempt, setMain, setStatus, useProgress, type Progress } from "@/lib/progress";
import { makeSetup } from "@/lib/setup";
import { logDrillAttempt } from "@/lib/solves";
import { chunkAlg, describeAlg, memoryTips, type Chunk } from "@/lib/triggers";
import { cn } from "@/lib/utils";

const TOGGLE_ITEM = "px-3 font-semibold aria-pressed:bg-foreground aria-pressed:text-background";
const SIZES = [3, 4, 5, 6];

export function LearnView() {
  const data = useLearn();
  const progress = useProgress();
  // The batch being worked on; kept here so the finished screen outlives the stored batch.
  const [session, setSession] = useState<string[] | null>(null);
  const set = data.set;
  const learned = (id: string) => entryFor(progress, id).status === "learned";
  // Cases you've marked Learned drop out of the batch.
  const stored = data.batch[set]?.filter((id) => !learned(id));
  const batch = stored?.length ? stored : undefined;

  if (session) return <Session batch={session} onExit={() => setSession(null)} />;

  const plan = planBatches(set, data.size, (id) => learned(id) || !!batch?.includes(id));
  const total = ALGS.filter((a) => a.set === set).length;
  const done = ALGS.filter((a) => a.set === set && learned(a.id)).length;

  function start(ids: string[]) {
    updateLearn((d) => ({
      ...d,
      batch: { ...d.batch, [set]: ids },
      cases: { ...d.cases, ...Object.fromEntries(ids.map((id) => [id, { stage: "pick", streak: 0 }])) },
    }));
    setSession(ids);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-12 sm:px-6 md:py-16">
      <div>
        <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">Learn a few at a time</h1>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">
          Work through a small batch of cases that belong together. For each one you pick the algorithm you like, learn
          it chunk by chunk, then recall it from the picture. A new case only comes in once the last one sticks, and the
          batch is done when you get every case {SOLID} times in a row without peeking.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <ToggleGroup
          value={[set]}
          onValueChange={(v) => v[0] && updateLearn((d) => ({ ...d, set: v[0] as AlgSet }))}
          variant="outline"
          spacing={0}
          aria-label="Algorithm set"
        >
          {SETS.map((s) => (
            <ToggleGroupItem key={s} value={s} className={TOGGLE_ITEM}>
              {s}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex items-center gap-3">
          <span id="size-label" className="text-sm text-muted-foreground">
            Cases per batch
          </span>
          <ToggleGroup
            value={[String(data.size)]}
            onValueChange={(v) => v[0] && updateLearn((d) => ({ ...d, size: Number(v[0]) }))}
            variant="outline"
            size="sm"
            spacing={0}
            aria-labelledby="size-label"
          >
            {SIZES.map((n) => (
              <ToggleGroupItem key={n} value={String(n)} className={cn(TOGGLE_ITEM, "tabular-nums")}>
                {n}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums sm:ml-auto">
          {done} of {total} learned
        </p>
      </div>

      {batch && (
        <section aria-labelledby="current-label" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="current-label" className="text-xl font-extrabold tracking-tight">
              Your batch
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => updateLearn((d) => ({ ...d, batch: { ...d.batch, [set]: undefined } }))}
            >
              Stop this batch
            </Button>
          </div>
          <BatchStrip batch={batch} data={data} />
          <Button size="lg" className="h-12 text-base font-bold" onClick={() => setSession(batch)}>
            Continue
          </Button>
        </section>
      )}

      <section aria-labelledby="plan-label" className="flex flex-col gap-4">
        <div>
          <h2 id="plan-label" className="text-2xl font-extrabold tracking-tight">
            {batch ? "Coming up" : "Suggested batches"}
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Cases that look alike or share moves are grouped, so you learn to tell them apart and reuse what your hands
            know. Mirror pairs stay together. Cases you&apos;ve marked Learned are left out, and if you already know one
            in a batch, mark it Learned while you work and it drops out. Start with any batch.
          </p>
        </div>
        {plan.length === 0 ? (
          <p className="text-muted-foreground">Every {set} case is learned or in your batch. Nice work.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {plan.map((b, i) => (
              <li key={b.ids.join()} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center">
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    {b.ids.map((id) => (
                      <CaseChip key={id} alg={ALGS_BY_ID.get(id)!} />
                    ))}
                  </div>
                  <ul className="text-sm text-muted-foreground">
                    {b.why.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
                {!batch && (
                  <Button variant={i === 0 ? "default" : "outline"} onClick={() => start(b.ids)} className="shrink-0">
                    {i === 0 ? "Start here" : "Start"}
                  </Button>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function CaseChip({ alg }: { alg: Alg }) {
  return (
    <Link
      href={`/algs/${alg.id}`}
      className="flex items-center gap-2 rounded-lg bg-muted py-1 pr-3 pl-1 text-sm font-semibold transition-colors hover:bg-muted/70"
    >
      <CaseImage alg={alg} className="size-8" />
      {alg.name}
    </Link>
  );
}

function stageLabel(data: LearnData, id: string) {
  const c = learnCase(data, id);
  if (c.stage === "pick") return "New";
  if (c.stage === "study") return "Studying";
  return c.streak >= SOLID ? "Solid" : `${c.streak} of ${SOLID}`;
}

function StreakDots({ streak, className }: { streak: number; className?: string }) {
  return (
    <span className={cn("flex gap-1", className)} aria-hidden>
      {Array.from({ length: SOLID }, (_, i) => (
        <span key={i} className={cn("size-2 rounded-[2px]", i < streak ? "bg-learned" : "bg-foreground/15")} />
      ))}
    </span>
  );
}

function BatchStrip({ batch, data, current }: { batch: string[]; data: LearnData; current?: string }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
      {batch.map((id) => {
        const alg = ALGS_BY_ID.get(id)!;
        const c = learnCase(data, id);
        return (
          <li
            key={id}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-transparent bg-muted p-2",
              current === id && "border-foreground/40",
            )}
          >
            <CaseImage alg={alg} className="size-9 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{alg.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {c.stage === "recall" && <StreakDots streak={c.streak} />}
                <span className="truncate">{stageLabel(data, id)}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Session

/** The cases in a batch you haven't marked Learned. */
const stillToLearn = (batch: string[], progress: Progress) => batch.filter((id) => entryFor(progress, id).status !== "learned");

function Session({ batch, onExit }: { batch: string[]; onExit: () => void }) {
  const data = useLearn();
  const progress = useProgress();
  const live = stillToLearn(batch, progress);
  const [last, setLast] = useState<string | null>(null);
  // Counts steps, so the same case twice in a row still starts fresh.
  const [round, setRound] = useState(0);
  const [task, setTask] = useState<Task>(() => nextTask(stillToLearn(batch, getProgress()), getLearn(), null));
  const [finished, setFinished] = useState<string[] | null>(null);

  const advance = useCallback(
    (id: string | null) => {
      if (id) setLast(id);
      setRound((r) => r + 1);
      const remaining = stillToLearn(batch, getProgress());
      const next = nextTask(remaining, getLearn(), id);
      if (next.kind === "done") {
        for (const b of remaining) setStatus(b, "learned");
        updateLearn((d) => ({ ...d, batch: { ...d.batch, [d.set]: undefined } }));
        setFinished(batch);
      }
      setTask(next);
    },
    [batch],
  );

  // Marking the case in front of you Learned takes it out of the batch.
  const current = task.kind === "done" ? undefined : task.id;
  const dropped = current !== undefined && !live.includes(current);
  useEffect(() => {
    if (dropped) advance(null);
  }, [dropped, advance]);

  if (finished) return <BatchDone ids={finished} onExit={onExit} />;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 md:py-10">
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" onClick={onExit}>
          Back to batches
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {task.kind === "recall" ? "Recall" : "New case"}
          {last === null && task.kind === "learn" && ": start with this one"}
        </p>
      </div>
      <BatchStrip batch={live} data={data} current={current} />
      {task.kind !== "done" && !dropped && <Step key={round} task={task} data={data} batch={live} onNext={advance} />}
    </div>
  );
}

function Step({ task, data, batch, onNext }: { task: Exclude<Task, { kind: "done" }>; data: LearnData; batch: string[]; onNext: (id: string) => void }) {
  const alg = ALGS_BY_ID.get(task.id)!;
  const progress = useProgress();
  const stage = learnCase(data, alg.id).stage;
  const entry = entryFor(progress, alg.id);
  const main = mainAlg(alg, entry);

  let body: React.ReactNode;
  if (task.kind === "recall") body = <RecallStep alg={alg} main={main} streak={learnCase(data, alg.id).streak} onNext={() => onNext(alg.id)} />;
  else if (stage === "pick") body = <PickStep alg={alg} progress={progress} />;
  else body = <StudyStep alg={alg} main={main} progress={progress} batch={batch} onDone={() => onNext(alg.id)} />;

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-10">
      <div className="mx-auto flex w-full max-w-56 flex-col gap-3 sm:max-w-xs md:sticky md:top-20 md:max-w-none">
        <div key={alg.id} className="animate-in rounded-2xl bg-muted p-5 duration-200 fade-in-0 md:p-8">
          <CaseImage alg={alg} className="w-full" />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{alg.name}</span> · {alg.group}
        </p>
        <StatusToggle
          id={alg.id}
          status={entry.status}
          onChange={(s) => s === "learned" && toast(`${alg.name} is Learned`, { description: "It's out of this batch and will come up in Drill." })}
        />
        {stage !== "pick" && <MainPicker alg={alg} main={main} options={allAlgs(alg, entry)} />}
      </div>
      <div className="flex min-w-0 flex-col gap-6">{body}</div>
    </div>
  );
}

/** Switch the algorithm you use. A new one has to be learned again, so the case goes back to Study. */
function MainPicker({ alg, main, options }: { alg: Alg; main: string; options: string[] }) {
  const items = options.map((a) => ({ value: a, label: a }));
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`main-${alg.id}`} className="text-xs font-semibold text-muted-foreground">
        Your algorithm
      </span>
      <Select
        items={items}
        value={main}
        onValueChange={(v) => {
          if (!v || v === main) return;
          setMain(alg.id, v);
          setCase(alg.id, { stage: "study", streak: 0 });
          toast("Switched algorithm", { description: "Learn the new one chunk by chunk, then recall it again." });
        }}
      >
        <SelectTrigger className="h-auto min-h-9 w-full font-mono text-xs whitespace-normal" aria-labelledby={`main-${alg.id}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value} className="font-mono text-xs">
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The algorithm as chunks. Chunks at or after `upTo` are dimmed; `masked` ones show only a blank. */
function ChunkedAlg({
  chunks,
  upTo = chunks.length,
  masked,
  onPeek,
  className,
}: {
  chunks: Chunk[];
  upTo?: number;
  masked?: Set<number>;
  onPeek?: (i: number) => void;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-wrap gap-2", className)}>
      {chunks.map((c, i) => {
        const hidden = masked?.has(i);
        const future = i > upTo;
        const active = i === upTo;
        const content = (
          <>
            <span className={cn("flex flex-wrap gap-x-[0.5em] font-mono font-semibold", hidden && "text-muted-foreground")}>
              {hidden ? c.moves.map((_, j) => <span key={j}>·</span>) : c.moves.map((m, j) => <span key={j}>{m}</span>)}
            </span>
            <span className="text-xs text-muted-foreground">{c.name ?? `${c.moves.length} moves`}</span>
          </>
        );
        const cls = cn(
          "flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-colors",
          active ? "border-primary bg-primary/10" : "border-border bg-card",
          future && "opacity-35",
        );
        return (
          <li key={i}>
            {hidden && onPeek ? (
              <button type="button" className={cn(cls, "hover:bg-muted")} onClick={() => onPeek(i)} aria-label={`Peek at chunk ${i + 1}`}>
                {content}
              </button>
            ) : (
              <div className={cls}>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function PickStep({ alg, progress }: { alg: Alg; progress: Progress }) {
  const entry = entryFor(progress, alg.id);
  const main = mainAlg(alg, entry);
  const options = allAlgs(alg, entry);
  const fewest = Math.min(...options.map(moveCount));
  const [trying, setTrying] = useState<{ alg: string; setup: string } | null>(null);

  function choose(a: string) {
    setMain(alg.id, a);
    setCase(alg.id, { stage: "study" });
  }

  return (
    <>
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Pick your algorithm</h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Try a few on your cube. Go for the one that flows best in your hands, not only the shortest: fewer regrips and
          familiar triggers are easier to remember.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {options.slice(0, 8).map((a) => {
          const tags = describeAlg(a);
          const isTrying = trying?.alg === a;
          return (
            <li key={a} className={cn("flex flex-col gap-3 rounded-xl border p-4", a === main ? "border-primary" : "border-border")}>
              <ChunkedAlg chunks={chunkAlg(a)} className="text-[0.95rem]" />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {a === main && entry.main && <span className="font-semibold text-primary">Your algorithm</span>}
                {a === alg.algs[0] && <span className="font-semibold text-foreground">Default</span>}
                {entry.custom?.includes(a) && <span className="font-semibold text-foreground">Yours</span>}
                {moveCount(a) === fewest && options.length > 1 && <span className="font-semibold text-foreground">Fewest moves</span>}
                {tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              {isTrying && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="mb-1 text-xs text-muted-foreground">Set up from solved, yellow on top, green in front, then try it:</p>
                  <MoveSequence alg={trying.setup} className="text-sm" />
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => choose(a)}>
                  Learn this one
                </Button>
                {a !== main && (
                  <Button size="sm" variant="outline" onClick={() => setMain(alg.id, a)}>
                    Make it yours
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setTrying(isTrying ? null : { alg: a, setup: makeSetup(alg, a) })}>
                  {isTrying ? "Hide setup" : "Try it"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted p-4 text-sm">
        <span className="text-muted-foreground">Already know {alg.name}?</span>
        <Button size="sm" variant="outline" onClick={() => setStatus(alg.id, "learned")}>
          Mark it Learned and skip it
        </Button>
      </div>
      {options.length > 8 && (
        <Link href={`/algs/${alg.id}`} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          See all {options.length} algorithms or add your own
        </Link>
      )}
    </>
  );
}

function useSetup(alg: Alg, main: string) {
  const [setup, setSetup] = useState<string | null>(null);
  // Random, so only on the client.
  useEffect(() => setSetup(makeSetup(alg, main)), [alg, main]);
  return [setup, () => setSetup(makeSetup(alg, main))] as const;
}

function SetupLine({ setup, reroll }: { setup: string | null; reroll: () => void }) {
  return (
    <section aria-labelledby="setup-label">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 id="setup-label" className="text-sm font-semibold text-muted-foreground">
          Set up from solved, yellow on top, green in front
        </h3>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={reroll}>
          <RefreshCwIcon data-icon="inline-start" />
          New setup <Kbd className="ml-1 hidden sm:inline-flex">N</Kbd>
        </Button>
      </div>
      {setup ? <MoveSequence key={setup} alg={setup} className="animate-in text-xl leading-snug duration-200 fade-in-0" /> : <p className="h-7" />}
    </section>
  );
}

function StudyStep({ alg, main, progress, batch, onDone }: { alg: Alg; main: string; progress: Progress; batch: string[]; onDone: () => void }) {
  const chunks = useMemo(() => chunkAlg(main), [main]);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"walk" | "memory">("walk");
  const [peeked, setPeeked] = useState<Set<number>>(new Set());
  const [setup, reroll] = useSetup(alg, main);
  const tips = useMemo(() => {
    const learned = new Set(ALGS.filter((a) => entryFor(progress, a.id).status === "learned").map((a) => a.id));
    return memoryTips(alg, main, (a) => mainAlg(a, entryFor(progress, a.id)), learned, new Set(batch));
  }, [alg, main, progress, batch]);
  const walked = step >= chunks.length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target instanceof Element && e.target.closest("input, button, a"))) return;
      if (e.key === "n") reroll();
      if (phase === "walk" && (e.key === " " || e.key === "ArrowRight")) {
        e.preventDefault();
        setStep((s) => Math.min(s + 1, chunks.length));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, chunks.length, reroll]);

  return (
    <>
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">{phase === "walk" ? "Learn it chunk by chunk" : "Now from memory"}</h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          {phase === "walk"
            ? "Set up the case, then do one chunk at a time. Say each chunk's name as you do it. Go through it a few times until it flows."
            : "Set it up again and solve it without looking. Tap a blank only if you're stuck, then go again."}
        </p>
      </div>

      <SetupLine setup={setup} reroll={reroll} />

      {phase === "walk" ? (
        <>
          <ChunkedAlg chunks={chunks} upTo={step} className="text-[clamp(1.05rem,2vw,1.35rem)]" />
          <div className="flex flex-wrap gap-2">
            {!walked ? (
              <Button size="lg" onClick={() => setStep(step + 1)}>
                {step === chunks.length - 1 ? "Done that chunk" : "Next chunk"} <Kbd className="ml-1 hidden bg-black/15 text-inherit sm:inline-flex">Space</Kbd>
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => {
                  setPhase("memory");
                  setPeeked(new Set());
                  reroll();
                }}
              >
                Try from memory
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            )}
            {step > 0 && (
              <Button size="lg" variant="outline" onClick={() => setStep(0)}>
                <RotateCcwIcon data-icon="inline-start" />
                From the start
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <ChunkedAlg
            chunks={chunks}
            masked={new Set(chunks.map((_, i) => i).filter((i) => !peeked.has(i)))}
            onPeek={(i) => setPeeked(new Set([...peeked, i]))}
            className="text-[clamp(1.05rem,2vw,1.35rem)]"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              className="bg-learned text-learned-foreground hover:bg-learned/85"
              onClick={() => {
                if (peeked.size) {
                  setPeeked(new Set());
                  reroll();
                } else {
                  setCase(alg.id, { stage: "recall", streak: 0 });
                  onDone();
                }
              }}
            >
              <CheckIcon data-icon="inline-start" />
              {peeked.size ? "Go again without peeking" : "Did it without peeking"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                setPhase("walk");
                setStep(0);
              }}
            >
              Walk through again
            </Button>
          </div>
        </>
      )}

      {tips.length > 0 && (
        <section aria-labelledby="tips-label" className="rounded-xl bg-muted p-4">
          <h3 id="tips-label" className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <LightbulbIcon className="size-4" aria-hidden />
            To remember it
          </h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
            {tips.map((t) => (
              <li key={t.text}>{t.text}</li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        onClick={() => setCase(alg.id, { stage: "pick" })}
      >
        Pick a different algorithm
      </button>
    </>
  );
}

function RecallStep({ alg, main, streak, onNext }: { alg: Alg; main: string; streak: number; onNext: () => void }) {
  const [setup, reroll] = useSetup(alg, main);
  const [shown, setShown] = useState(false);
  const [shownAt] = useState(() => performance.now());
  const chunks = useMemo(() => chunkAlg(main), [main]);

  const answer = useCallback(
    (ok: boolean) => {
      recordRecall(alg.id, ok);
      recordAttempt(alg.id, ok);
      logDrillAttempt({ id: alg.id, ok, ms: Math.round(performance.now() - shownAt), revealed: !ok, at: Date.now() });
    },
    [alg.id, shownAt],
  );

  const showMe = useCallback(() => {
    if (shown) return;
    answer(false);
    setShown(true);
  }, [answer, shown]);

  const gotIt = useCallback(() => {
    answer(true);
    onNext();
  }, [answer, onNext]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target instanceof Element && e.target.closest("input, button, a"))) return;
      if (e.key === "n") reroll();
      else if (shown && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        onNext();
      } else if (!shown && (e.key === " " || e.key === "j")) {
        e.preventDefault();
        showMe();
      } else if (!shown && e.key === "k") gotIt();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, reroll, onNext, showMe, gotIt]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Solve it from the picture</h2>
          <p className="mt-2 text-muted-foreground">
            {streak >= SOLID ? "It's solid. A quick check that it stays that way." : `${SOLID - streak} more clean ${SOLID - streak === 1 ? "solve" : "solves"} in a row and it's solid.`}
          </p>
        </div>
        <StreakDots streak={streak} className="[&>span]:size-3" />
      </div>

      <SetupLine setup={setup} reroll={reroll} />

      {shown ? (
        <div className="flex flex-col gap-4 animate-in duration-200 fade-in-0">
          <ChunkedAlg chunks={chunks} className="text-[clamp(1.05rem,2vw,1.35rem)]" />
          <p className="text-sm text-muted-foreground">Do it once with the moves in front of you. This one comes back soon.</p>
          <Button size="lg" className="h-12 self-start text-base font-bold" onClick={onNext}>
            Next <Kbd className="ml-1 hidden bg-black/15 text-inherit sm:inline-flex">Space</Kbd>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" variant="outline" className="h-14 text-base font-bold" onClick={showMe}>
            <EyeIcon data-icon="inline-start" />
            Show me <Kbd className="ml-1 hidden sm:inline-flex">J</Kbd>
          </Button>
          <Button size="lg" className="h-14 bg-learned text-base font-bold text-learned-foreground hover:bg-learned/85" onClick={gotIt}>
            Got it <Kbd className="ml-1 hidden bg-black/15 text-inherit sm:inline-flex">K</Kbd>
          </Button>
        </div>
      )}
    </>
  );
}

function BatchDone({ ids, onExit }: { ids: string[]; onExit: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-6 px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Batch learned</h1>
      <p className="max-w-prose text-muted-foreground">
        All {ids.length} are marked Learned and will come up in Drill now and then, so they stay fresh. Come back
        tomorrow for a quick drill before you start the next batch.
      </p>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <CaseChip key={id} alg={ALGS_BY_ID.get(id)!} />
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="lg" onClick={onExit}>
          Pick the next batch
        </Button>
        <Link href="/drill" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Open Drill
        </Link>
      </div>
    </div>
  );
}
