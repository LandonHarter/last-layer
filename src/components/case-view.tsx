"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { ALGS, ALGS_BY_ID, type Alg } from "@/data/algs";
import { CaseImage } from "@/components/algs/case-image";
import { MoveSequence } from "@/components/algs/move-sequence";
import { StatusToggle } from "@/components/algs/status-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fitAlg, isValidNotation } from "@/lib/cases";
import { moveCount } from "@/lib/notation";
import { addCustom, allAlgs, entryFor, mainAlg, removeCustom, setMain, useProgress } from "@/lib/progress";
import { makeSetup } from "@/lib/setup";
import { cn } from "@/lib/utils";

export function CaseView({ id }: { id: string }) {
  const alg = ALGS_BY_ID.get(id)!;
  const progress = useProgress();
  const entry = entryFor(progress, id);
  const main = mainAlg(alg, entry);
  const algs = allAlgs(alg, entry);
  const custom = new Set(entry.custom ?? []);

  const inSet = ALGS.filter((a) => a.set === alg.set);
  const index = inSet.indexOf(alg);
  const prev = inSet[index - 1];
  const next = inSet[index + 1];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-6 sm:px-6 md:py-10">
      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Cases">
        <p className="text-muted-foreground">
          <Link href="/" className="font-semibold text-foreground underline-offset-4 hover:underline">
            Library
          </Link>
          <span aria-hidden> / </span>
          {alg.set} <span aria-hidden>/</span> {alg.group}
        </p>
        <div className="flex gap-1">
          <CaseLink alg={prev} dir="prev" />
          <CaseLink alg={next} dir="next" />
        </div>
      </nav>

      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12">
        <div className="mx-auto w-full max-w-72 rounded-2xl bg-muted p-6 sm:max-w-sm md:sticky md:top-20 md:max-w-none md:p-10">
          <CaseImage alg={alg} className="w-full" />
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          <header className="flex flex-col gap-4">
            <div>
              <h1 className="text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">{alg.name}</h1>
              <p className="mt-2 text-muted-foreground">
                {alg.group}
                {alg.set === "F2L" && ", front-right slot"}
                {entry.attempts > 0 && (
                  <>
                    . Drilled {entry.attempts} {entry.attempts === 1 ? "time" : "times"}
                    {entry.misses > 0 && (
                      <>
                        , <span className="text-missed">missed {entry.misses}</span>
                      </>
                    )}
                  </>
                )}
              </p>
            </div>
            <StatusToggle id={alg.id} status={entry.status} size="default" className="max-w-md" />
          </header>

          <section aria-labelledby="main-label">
            <h2 id="main-label" className="mb-2 text-sm font-semibold text-muted-foreground">
              Your algorithm
            </h2>
            <MoveSequence
              key={main}
              alg={main}
              className="animate-in text-[clamp(1.4rem,3vw,2.2rem)] leading-tight font-bold duration-200 fade-in-0"
            />
          </section>

          <PracticeSetup alg={alg} main={main} />
        </div>
      </div>

      <section aria-labelledby="algs-label" className="flex flex-col gap-4">
        <h2 id="algs-label" className="border-b border-border pb-2 text-2xl font-extrabold tracking-tight">
          Algorithms
          <span className="ml-2 text-base font-medium text-muted-foreground tabular-nums">{algs.length}</span>
        </h2>
        <p className="-mt-1 max-w-prose text-sm text-muted-foreground">
          Pick the one you use. Drill shows it when you reveal the answer, and setups are built so they don&apos;t
          give it away.
        </p>

        <div role="radiogroup" aria-labelledby="algs-label" className="flex flex-col">
          {algs.map((a) => (
            <AlgOption
              key={a}
              alg={a}
              selected={a === main}
              isDefault={a === alg.algs[0]}
              isCustom={custom.has(a)}
              onSelect={() => setMain(alg.id, a)}
              onRemove={() => {
                removeCustom(alg.id, a);
                toast("Removed your algorithm", {
                  action: { label: "Undo", onClick: () => addCustom(alg.id, a) },
                });
              }}
            />
          ))}
        </div>

        <AddCustom alg={alg} existing={algs} />
      </section>
    </div>
  );
}

function CaseLink({ alg, dir }: { alg: Alg | undefined; dir: "prev" | "next" }) {
  const Icon = dir === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  if (!alg) return <span className="w-24" aria-hidden />;
  return (
    <Link href={`/algs/${alg.id}`} className={buttonVariants({ variant: "ghost" })} aria-label={`${dir === "prev" ? "Previous" : "Next"}: ${alg.name}`}>
      {dir === "prev" && <Icon data-icon="inline-start" />}
      {alg.name}
      {dir === "next" && <Icon data-icon="inline-end" />}
    </Link>
  );
}

function PracticeSetup({ alg, main }: { alg: Alg; main: string }) {
  const [setup, setSetup] = useState<string | null>(null);
  // Random, so only on the client.
  useEffect(() => setSetup(makeSetup(alg, main)), [alg, main]);

  return (
    <section aria-labelledby="setup-label" className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="setup-label" className="text-sm font-semibold text-muted-foreground">
          Practice setup: from solved, yellow on top, green in front
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setSetup(makeSetup(alg, main))}>
          <RefreshCwIcon data-icon="inline-start" />
          New setup
        </Button>
      </div>
      {setup ? (
        <MoveSequence key={setup} alg={setup} className="animate-in text-lg leading-snug duration-200 fade-in-0" />
      ) : (
        <p className="h-7" />
      )}
    </section>
  );
}

function AlgOption({
  alg,
  selected,
  isDefault,
  isCustom,
  onSelect,
  onRemove,
}: {
  alg: string;
  selected: boolean;
  isDefault: boolean;
  isCustom: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const count = moveCount(alg);
  return (
    <div
      className={cn(
        "group/option flex items-center gap-3 border-b border-border/70 transition-colors",
        selected ? "bg-muted" : "hover:bg-muted/50",
      )}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 px-3 py-3.5">
        <input type="radio" name="main-alg" checked={selected} onChange={onSelect} className="peer sr-only" />
        {/* A sticker marks your algorithm, like the squares on the progress board. */}
        <span
          aria-hidden
          className={cn(
            "size-4 shrink-0 rounded-[3px] ring-2 ring-inset transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
            selected ? "bg-primary ring-primary" : "ring-foreground/25",
          )}
        />
        <MoveSequence alg={alg} className={cn("min-w-0 flex-1 text-[0.95rem] leading-snug", selected && "font-bold")} />
        <span className="flex shrink-0 flex-col items-end text-xs text-muted-foreground sm:flex-row sm:gap-3">
          {isCustom && <span className="font-semibold text-foreground">Yours</span>}
          {isDefault && !isCustom && <span>Default</span>}
          <span className="tabular-nums">{count} moves</span>
        </span>
      </label>
      {isCustom && (
        <Button variant="ghost" size="sm" className="mr-2 text-muted-foreground" onClick={onRemove}>
          Remove
        </Button>
      )}
    </div>
  );
}

function AddCustom({ alg, existing }: { alg: Alg; existing: string[] }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = value.trim();
    if (!input) return;
    if (!isValidNotation(input)) {
      return setError("Some of those moves aren't notation this app reads. Use moves like R U R' U2, M, r, x.");
    }
    const fitted = fitAlg(alg.set, alg.algs[0], input);
    if (!fitted) {
      return setError(
        `That doesn't solve ${alg.name}${alg.set === "F2L" ? " into the front-right slot" : ""}, or it turns the whole cube. Try it on the practice setup above.`,
      );
    }
    if (existing.includes(fitted)) return setError("That one is already in the list.");
    addCustom(alg.id, fitted);
    setValue("");
    setError(null);
    toast(fitted === input.replace(/\s+/g, " ") ? "Added your algorithm" : `Added as ${fitted}`, {
      description: fitted === input.replace(/\s+/g, " ") ? undefined : "Adjusted so it starts from the angle in the picture.",
      action: { label: "Use it", onClick: () => setMain(alg.id, fitted) },
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 pt-2">
      <label htmlFor="custom-alg" className="text-sm font-semibold">
        Add your own
      </label>
      <div className="flex gap-2">
        <Input
          id="custom-alg"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="R U R' U R U2 R'"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "custom-alg-error" : "custom-alg-hint"}
          autoComplete="off"
          spellCheck={false}
          className="h-10 max-w-xl font-mono"
        />
        <Button type="submit" size="lg" className="h-10 px-4 font-semibold">
          Add
        </Button>
      </div>
      {error ? (
        <p id="custom-alg-error" className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p id="custom-alg-hint" className="text-sm text-muted-foreground">
          It&apos;s checked on a simulated cube before it&apos;s added. A turn of the top at the start is fine.
        </p>
      )}
    </form>
  );
}
