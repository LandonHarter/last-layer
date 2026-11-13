"use client";

import Link from "next/link";
import { slotSiblings, type Alg } from "@/data/algs";
import { SLOT_INFO } from "@/lib/f2l-slot";
import { entryFor, mainAlg, STATUS_LABELS, type Entry, type Progress } from "@/lib/progress";
import { cn } from "@/lib/utils";
import { CaseImage } from "./case-image";
import { MoveSequence } from "./move-sequence";
import { StatusToggle } from "./status-toggle";

const SWATCH = { unknown: "bg-unknown", learning: "bg-learning", learned: "bg-learned" } as const;

export function AlgCard({ alg, entry, progress }: { alg: Alg; entry: Entry; progress?: Progress }) {
  const count = alg.algs.length + (entry.custom?.length ?? 0);
  return (
    // Phones: image and details side by side, the status toggle full width under them.
    <article className="flex flex-wrap gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground sm:flex-col sm:flex-nowrap">
      <Link
        href={`/algs/${alg.id}`}
        tabIndex={-1}
        aria-hidden
        className="w-20 shrink-0 rounded-lg bg-muted/70 p-2 transition-colors hover:bg-muted sm:w-full sm:px-4 sm:py-3"
      >
        <CaseImage alg={alg} className="mx-auto w-full max-w-32" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-base font-bold leading-tight">
            <Link href={`/algs/${alg.id}`} className="underline-offset-4 hover:underline">
              {alg.name}
            </Link>
          </h3>
          {entry.attempts > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground" title="Drill results">
              {entry.attempts - entry.misses}/{entry.attempts}
            </span>
          )}
        </div>
        <MoveSequence alg={mainAlg(alg, entry)} className="text-[0.8rem] leading-snug" />
        {count > 1 && (
          <Link href={`/algs/${alg.id}`} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {count - 1} more {count - 1 === 1 ? "algorithm" : "algorithms"}
          </Link>
        )}
      </div>
      {alg.slot && progress ? (
        // The toggle sets front-right; the other slots open their own page.
        <div className="flex w-full flex-col gap-2 sm:mt-auto">
          <SlotChips alg={alg} progress={progress} />
          <StatusToggle id={alg.id} status={entry.status} />
        </div>
      ) : (
        <StatusToggle id={alg.id} status={entry.status} className="sm:mt-auto" />
      )}
    </article>
  );
}

/** Each slot's status as a square, like the progress board; a click opens that slot. */
function SlotChips({ alg, progress }: { alg: Alg; progress: Progress }) {
  return (
    <div className="flex items-center gap-1" aria-label="Slots">
      {slotSiblings(alg).map((a) => {
        const status = entryFor(progress, a.id).status;
        return (
          <Link
            key={a.id}
            href={`/algs/${a.id}`}
            title={`${SLOT_INFO[a.slot!].label}: ${STATUS_LABELS[status]}`}
            aria-label={`${alg.name}, ${SLOT_INFO[a.slot!].label.toLowerCase()} slot: ${STATUS_LABELS[status]}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span aria-hidden className={cn("size-2.5 rounded-[2px]", SWATCH[status])} />
            {a.slot}
          </Link>
        );
      })}
    </div>
  );
}
