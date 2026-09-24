"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LightbulbIcon, PencilIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ALGS, ALGS_BY_ID, SETS, type AlgSet } from "@/data/algs";
import { CaseImage } from "@/components/algs/case-image";
import { MoveSequence } from "@/components/algs/move-sequence";
import { NotesField } from "@/components/algs/notes-field";
import { StatusToggle } from "@/components/algs/status-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { entryFor, getProgress, mainAlg, recordAttempt, setStatus, useProgress, type Progress } from "@/lib/progress";
import { pickNext, STATUS_WEIGHT } from "@/lib/scheduler";
import { makeSetup } from "@/lib/setup";
import { logDrillAttempt } from "@/lib/solves";
import { cn } from "@/lib/utils";

type SetFilter = "all" | AlgSet;

function poolFor(progress: Progress, set: SetFilter) {
  return ALGS.filter((a) => set === "all" || a.set === set)
    .map((a) => ({ id: a.id, entry: entryFor(progress, a.id) }))
    .filter((p) => STATUS_WEIGHT[p.entry.status] > 0);
}

export function DrillView() {
  const progress = useProgress();
  const [set, setSet] = useState<SetFilter>("all");
  const [session, setSession] = useState<SessionState | null>(null);

  const pool = poolFor(progress, set);
  const learning = pool.filter((p) => p.entry.status === "learning").length;
  const learned = pool.length - learning;

  function start() {
    const first = pickNext(pool, []);
    if (first) setSession({ current: first, setup: setupFor(first), recent: [first], done: 0, missed: 0 });
  }

  if (session) {
    return <Session session={session} setSession={setSession} set={set} progress={progress} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 md:py-20">
      <div>
        <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">Drill your algorithms</h1>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">
          You&apos;ll see a case and moves that set it up. Do the setup on your cube, solve it with your algorithm, then
          mark how it went. Setups change every time and never just undo your algorithm. In progress cases come up about six times as often as learned ones, and a miss brings a case
          back sooner.
        </p>
      </div>

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold">Cases to drill</span>
          <ToggleGroup
            value={[set]}
            onValueChange={(v) => v[0] && setSet(v[0] as SetFilter)}
            variant="outline"
            spacing={0}
            aria-label="Algorithm set"
          >
            {(["all", ...SETS] as const).map((s) => (
              <ToggleGroupItem key={s} value={s} className="px-3 font-semibold aria-pressed:bg-foreground aria-pressed:text-background">
                {s === "all" ? "All" : s}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted p-4">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-2.5 rounded-[2px] bg-learning" /> In progress
            </dt>
            <dd className="mt-1 text-4xl font-extrabold tabular-nums">{learning}</dd>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-2.5 rounded-[2px] bg-learned" /> Learned
            </dt>
            <dd className="mt-1 text-4xl font-extrabold tabular-nums">{learned}</dd>
          </div>
        </dl>

        {pool.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              Nothing to drill yet. Mark algorithms as In progress or Learned in the Library and they&apos;ll show up
              here.
            </p>
            <Link href="/" className={buttonVariants({ size: "lg" })}>
              Open the Library
            </Link>
          </div>
        ) : (
          <Button size="lg" className="h-12 text-base font-bold" onClick={start}>
            Start drill
          </Button>
        )}
      </div>
    </div>
  );
}

type SessionState = { current: string; setup: string; recent: string[]; done: number; missed: number };

/** A fresh setup for the case, built around the algorithm you use for it. */
function setupFor(id: string): string {
  const alg = ALGS_BY_ID.get(id)!;
  return makeSetup(alg, mainAlg(alg, entryFor(getProgress(), id)));
}

function Session({
  session,
  setSession,
  set,
  progress,
}: {
  session: SessionState;
  setSession: (s: SessionState | null) => void;
  set: SetFilter;
  progress: Progress;
}) {
  const [revealed, setRevealed] = useState(false);
  const [hinted, setHinted] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const alg = ALGS_BY_ID.get(session.current)!;
  // When this case appeared, for the answer time in Analyze.
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = performance.now();
  }, [session.current, session.done]);
  const entry = entryFor(progress, alg.id);
  const main = mainAlg(alg, entry);
  const notes = entry.notes?.trim();
  const allCount = alg.algs.length + (entry.custom?.length ?? 0);
  const reroll = useCallback(() => setSession({ ...session, setup: setupFor(alg.id) }), [alg.id, session, setSession]);

  const answer = useCallback(
    (success: boolean) => {
      const wasLearned = entryFor(getProgress(), alg.id).status === "learned";
      recordAttempt(alg.id, success);
      logDrillAttempt({ id: alg.id, ok: success, ms: Math.round(performance.now() - shownAt.current), revealed, hinted, at: Date.now() });
      if (!success && wasLearned) {
        toast(`Missed ${alg.name}`, {
          description: "It's marked Learned. Move it back to get more practice?",
          action: { label: "Move to In progress", onClick: () => setStatus(alg.id, "learning") },
        });
      }
      const next = pickNext(poolFor(getProgress(), set), session.recent);
      setRevealed(false);
      setHinted(false);
      setEditingNotes(false);
      if (!next) return setSession(null);
      setSession({
        current: next,
        setup: setupFor(next),
        recent: [...session.recent, next].slice(-10),
        done: session.done + 1,
        missed: session.missed + (success ? 0 : 1),
      });
    },
    [alg, revealed, hinted, session, set, setSession],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, textarea, [role=listbox]")) return;
      if (e.key === " " || e.key === "Enter") {
        if (target?.closest("button, a")) return;
        e.preventDefault();
        setRevealed(true);
      } else if (e.key === "j" || e.key === "ArrowLeft") {
        answer(false);
      } else if (e.key === "k" || e.key === "ArrowRight") {
        answer(true);
      } else if (e.key === "h") {
        if (notes) setHinted(true);
      } else if (e.key === "n") {
        reroll();
      } else if (e.key === "Escape") {
        setSession(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, notes, reroll, setSession]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 md:py-10">
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" onClick={() => setSession(null)}>
          End session <Kbd className="ml-1 hidden sm:inline-flex">Esc</Kbd>
        </Button>
        <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
          <span className="font-semibold text-foreground">{session.done}</span> done
          {session.missed > 0 && (
            <>
              , <span className="font-semibold text-missed">{session.missed}</span> missed
            </>
          )}
        </p>
      </div>

      <div className="grid flex-1 items-start gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10">
        <div
          key={alg.id}
          className="mx-auto w-full max-w-64 animate-in rounded-2xl bg-muted p-5 duration-200 fade-in-0 sm:max-w-sm md:max-w-none md:p-10"
        >
          <CaseImage alg={alg} className="w-full" />
        </div>

        <div className="flex flex-col gap-7">
          <section aria-labelledby="setup-label">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id="setup-label" className="text-sm font-semibold text-muted-foreground">
                Set up from solved, yellow on top, green in front
              </h2>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={reroll}>
                <RefreshCwIcon data-icon="inline-start" />
                New setup <Kbd className="ml-1 hidden sm:inline-flex">N</Kbd>
              </Button>
            </div>
            <MoveSequence
              key={session.setup}
              alg={session.setup}
              className="animate-in text-[clamp(1.35rem,2.8vw,2.1rem)] leading-tight tracking-tight duration-200 fade-in-0"
            />
          </section>

          <section aria-labelledby="answer-label" className="rounded-xl border border-border bg-card p-5">
            <h2 id="answer-label" className="sr-only">
              Algorithm
            </h2>
            {revealed ? (
              <div className="flex flex-col gap-4 animate-in duration-200 fade-in-0">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-2xl font-extrabold">{alg.name}</span>
                  <span className="text-sm text-muted-foreground">{alg.group}</span>
                  <Link
                    href={`/algs/${alg.id}`}
                    className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    All {allCount} algorithms
                  </Link>
                </div>
                <MoveSequence alg={main} className="text-[clamp(1.25rem,2.6vw,1.9rem)] leading-tight font-bold text-foreground" />
                {notes || editingNotes ? (
                  <Notes id={alg.id} notes={entry.notes} editing={editingNotes} setEditing={setEditingNotes} />
                ) : (
                  <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => setEditingNotes(true)}>
                    <PencilIcon data-icon="inline-start" />
                    Add notes
                  </Button>
                )}
                <StatusToggle id={alg.id} status={entry.status} size="default" className="max-w-md" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {hinted && (notes || editingNotes) && <Notes id={alg.id} notes={entry.notes} editing={editingNotes} setEditing={setEditingNotes} />}
                <div className="flex gap-3">
                  {notes && !hinted && (
                    <Button variant="outline" size="lg" className="h-12 text-base font-semibold" onClick={() => setHinted(true)}>
                      <LightbulbIcon data-icon="inline-start" />
                      Hint <Kbd className="ml-1 hidden sm:inline-flex">H</Kbd>
                    </Button>
                  )}
                  <Button variant="secondary" size="lg" className="h-12 flex-1 text-base font-semibold" onClick={() => setRevealed(true)}>
                    Reveal algorithm <Kbd className="ml-1 hidden sm:inline-flex">Space</Kbd>
                  </Button>
                </div>
              </div>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              variant="outline"
              className="h-14 border-missed/40 text-base font-bold text-missed hover:bg-missed/10 hover:text-missed"
              onClick={() => answer(false)}
            >
              Missed <Kbd className="ml-1 hidden sm:inline-flex">J</Kbd>
            </Button>
            <Button
              size="lg"
              className={cn("h-14 bg-learned text-base font-bold text-learned-foreground hover:bg-learned/85")}
              onClick={() => answer(true)}
            >
              Got it <Kbd className="ml-1 hidden bg-black/15 text-inherit sm:inline-flex">K</Kbd>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Notes({
  id,
  notes,
  editing,
  setEditing,
}: {
  id: string;
  notes: string | undefined;
  editing: boolean;
  setEditing: (editing: boolean) => void;
}) {
  return (
    <div className="animate-in rounded-lg bg-muted p-4 duration-200 fade-in-0">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <LightbulbIcon className="size-4" aria-hidden /> Your notes
        </h3>
        <Button variant="ghost" size="sm" className="-my-1 text-muted-foreground" onClick={() => setEditing(!editing)}>
          {editing ? "Done" : "Edit"}
        </Button>
      </div>
      {editing ? (
        <NotesField id={id} notes={notes} onDone={() => setEditing(false)} autoFocus className="bg-background dark:bg-background" />
      ) : (
        <p className="whitespace-pre-wrap text-base leading-relaxed">{notes?.trim()}</p>
      )}
    </div>
  );
}
