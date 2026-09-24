"use client";

import Link from "next/link";
import type { Alg } from "@/data/algs";
import { mainAlg, type Entry } from "@/lib/progress";
import { CaseImage } from "./case-image";
import { MoveSequence } from "./move-sequence";
import { StatusToggle } from "./status-toggle";

export function AlgCard({ alg, entry }: { alg: Alg; entry: Entry }) {
  const count = alg.algs.length + (entry.custom?.length ?? 0);
  return (
    <article className="flex gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground sm:flex-col">
      <Link
        href={`/algs/${alg.id}`}
        tabIndex={-1}
        aria-hidden
        className="w-24 shrink-0 rounded-lg bg-muted/70 p-2 transition-colors hover:bg-muted sm:w-full sm:px-4 sm:py-3"
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
        <StatusToggle id={alg.id} status={entry.status} className="mt-auto" />
      </div>
    </article>
  );
}
