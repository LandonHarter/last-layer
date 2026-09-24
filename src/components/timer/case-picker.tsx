"use client";

import { useMemo, useRef, useState } from "react";
import { CheckIcon, PlusIcon, SearchIcon } from "lucide-react";
import { CaseImage } from "@/components/algs/case-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ALGS, ALGS_BY_ID } from "@/data/algs";
import { entryFor, mainAlg, useProgress } from "@/lib/progress";
import { setSolveCase, type Solve, type SolveStep } from "@/lib/solves";
import { cn } from "@/lib/utils";

const CASES = {
  oll: ALGS.filter((a) => a.set === "OLL"),
  pll: ALGS.filter((a) => a.set === "PLL"),
};

const normalize = (s: string) => s.toLowerCase().replace(/[\s-]+/g, " ").trim();

/** Ghost button that tags a solve with the OLL or PLL case it had. Optional. */
export function CasePicker({ solve, step, className }: { solve: Solve; step: SolveStep; className?: string }) {
  const progress = useProgress();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const label = step.toUpperCase();
  const picked = solve[step] ? ALGS_BY_ID.get(solve[step]) : undefined;

  const matches = useMemo(() => {
    const words = normalize(query).split(" ").filter(Boolean);
    if (!words.length) return CASES[step];
    // "21", "oll 21", "t perm" and group names like "dot" all match.
    return CASES[step].filter((a) => {
      const hay = normalize(`${a.name} ${a.group} ${a.id}`);
      return words.every((w) => hay.split(" ").some((part) => part.startsWith(w)));
    });
  }, [query, step]);

  function choose(id: string | undefined) {
    setSolveCase(solve.id, step, id);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={cn(picked ? "text-foreground" : "text-muted-foreground", className)}
            aria-label={picked ? `${label}: ${picked.name}. Change` : `Set the ${label} you had`}
          />
        }
      >
        {picked ? (
          <>
            <CaseImage alg={picked} className="size-5" />
            {picked.name}
          </>
        ) : (
          <>
            <PlusIcon data-icon="inline-start" />
            {label}
          </>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 gap-2 p-2" initialFocus={inputRef}>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches.length) {
                e.preventDefault();
                choose(matches[0].id);
              }
            }}
            placeholder={`Search ${label}s`}
            aria-label={`Search ${label} cases`}
            className="h-9 pl-8"
          />
        </div>
        <ul role="listbox" aria-label={`${label} cases`} className="scrollbar-sleek -mr-2 -ml-1 max-h-80 overflow-y-auto pr-0.5 pl-1 [scrollbar-gutter:stable]">
          {matches.map((a) => {
            const selected = a.id === picked?.id;
            return (
              <li key={a.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => choose(a.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
                    selected && "bg-muted",
                  )}
                >
                  <CaseImage alg={a} className="size-10 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{a.name}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">{mainAlg(a, entryFor(progress, a.id))}</span>
                  </span>
                  {selected && <CheckIcon className="size-4 shrink-0 text-primary" />}
                </button>
              </li>
            );
          })}
          {!matches.length && <li className="px-2 py-6 text-center text-sm text-muted-foreground">No {label} matches “{query}”.</li>}
        </ul>
        {picked && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => choose(undefined)}>
            Clear {label}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
