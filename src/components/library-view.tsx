"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { ALGS, GROUPS, SET_TITLES, SETS, type Alg, type AlgSet } from "@/data/algs";
import { AlgCard } from "@/components/algs/alg-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { entryFor, STATUS_LABELS, useProgress, type Progress, type Status } from "@/lib/progress";
import { cn } from "@/lib/utils";

type SetFilter = "all" | AlgSet;
type StatusFilter = "all" | Status;

const STATUS_ITEMS = [
  { value: "all", label: "Any status" },
  ...(Object.entries(STATUS_LABELS) as [Status, string][]).map(([value, label]) => ({ value, label })),
];

const SWATCH: Record<Status, string> = {
  unknown: "bg-unknown",
  learning: "bg-learning",
  learned: "bg-learned",
};

const bareName = (alg: Alg) => alg.name.toLowerCase().replace(/^(f2l|oll) /, "").replace(/ perm$/, "");

/** Search matcher. A query naming a case ("21", "t perm", "j") shows just those cases. */
function makeMatcher(query: string): (alg: Alg) => boolean {
  const raw = query.replace(/\s+/g, " ").trim();
  if (!raw) return () => true;
  const q = raw.toLowerCase();
  // "oll 21" means that case only; a bare "21" matches both F2L 21 and OLL 21.
  const prefix = /^(f2l|oll|pll)\b/.exec(q)?.[1]?.toUpperCase();
  const inSet = (a: Alg) => !prefix || a.set === prefix;
  const bare = q.replace(/^(f2l|oll|pll)\s*/, "").replace(/\s*perm$/, "");
  if (ALGS.some((a) => inSet(a) && bareName(a) === bare)) return (a) => inSet(a) && bareName(a) === bare;
  // "j" or "g" means the J or G perms, not every shape with that letter in it.
  if (/^[a-z]$/.test(bare) && ALGS.some((a) => bareName(a).startsWith(bare))) {
    return (a) => a.set === "PLL" && bareName(a).startsWith(bare);
  }
  return (a) =>
    a.name.toLowerCase().includes(q) ||
    a.group.toLowerCase().includes(q) ||
    // Notation is case-sensitive: r is a wide move, R is not.
    a.algs.some((alg) => alg.includes(raw));
}

export function LibraryView() {
  const progress = useProgress();
  const [query, setQuery] = useState("");
  const [set, setSet] = useState<SetFilter>("all");
  const [status, setStatusFilter] = useState<StatusFilter>("all");
  const [group, setGroup] = useState("all");
  const deferredQuery = useDeferredValue(query);

  const groupItems = useMemo(() => {
    const sets: AlgSet[] = set === "all" ? SETS : [set];
    return [
      { value: "all", label: "Any shape" },
      ...sets.flatMap((s) => GROUPS[s].map((g) => ({ value: `${s}:${g}`, label: set === "all" ? `${g} (${s})` : g }))),
    ];
  }, [set]);

  const matches = makeMatcher(deferredQuery);
  const visible = ALGS.filter(
    (a) =>
      (set === "all" || a.set === set) &&
      (status === "all" || entryFor(progress, a.id).status === status) &&
      (group === "all" || `${a.set}:${a.group}` === group) &&
      matches(a),
  );

  const filtered = query !== "" || set !== "all" || status !== "all" || group !== "all";
  const clear = () => {
    setQuery("");
    setSet("all");
    setStatusFilter("all");
    setGroup("all");
  };

  return (
    <>
      <section className="mx-auto grid w-full max-w-7xl px-4 sm:px-6 gap-8 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-end md:py-14">
        <div className="max-w-xl">
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-balance sm:text-5xl">
            Every F2L, OLL and PLL case, one place to learn them
          </h1>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">
            Mark a case <strong className="font-semibold text-foreground">In progress</strong> when you start learning it.
            In progress and Learned cases show up in Drill, with the ones you&apos;re still learning coming back most.
            Open a case to see every algorithm for it and pick the one you use.
          </p>
        </div>
        <ProgressBoard progress={progress} />
      </section>

      <div className="sticky top-14 z-30 mb-6 border-y border-border bg-background/90 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-4 sm:px-6">
          <div className="relative min-w-52 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search: OLL 21, T perm, R U R'…"
              aria-label="Search algorithms"
              className="h-9 pl-8"
            />
          </div>
          <ToggleGroup
            value={[set]}
            onValueChange={(v) => {
              if (!v[0]) return;
              setSet(v[0] as SetFilter);
              setGroup("all");
            }}
            variant="outline"
            spacing={0}
            size="lg"
            aria-label="Algorithm set"
          >
            {(["all", ...SETS] as const).map((s) => (
              <ToggleGroupItem key={s} value={s} className="px-3 font-semibold aria-pressed:bg-foreground aria-pressed:text-background">
                {s === "all" ? "All" : s}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select items={STATUS_ITEMS} value={status} onValueChange={(v) => setStatusFilter((v ?? "all") as StatusFilter)}>
            <SelectTrigger className="h-9 min-w-36" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.value !== "all" && <span className={cn("size-2.5 rounded-full", SWATCH[item.value as Status])} />}
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select items={groupItems} value={group} onValueChange={(v) => setGroup(v ?? "all")}>
            <SelectTrigger className="h-9 min-w-36" aria-label="Filter by shape">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groupItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtered && (
            <Button variant="ghost" size="lg" onClick={clear}>
              <XIcon data-icon="inline-start" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6">
      <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
        Showing {visible.length} of {ALGS.length}
      </p>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <p className="font-semibold">No algorithms match these filters.</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a case number like 21, a letter like T, or a move like R U R&apos;.</p>
          <Button variant="outline" className="mt-4" onClick={clear}>
            Clear filters
          </Button>
        </div>
      ) : (
        <Sections algs={visible} progress={progress} />
      )}
      </div>
    </>
  );
}

function Sections({ algs, progress }: { algs: Alg[]; progress: Progress }) {
  const sets = SETS.map((set) => ({
      set,
      groups: GROUPS[set]
        .map((group) => ({ group, algs: algs.filter((a) => a.set === set && a.group === group) }))
        .filter((g) => g.algs.length > 0),
    }))
    .filter((s) => s.groups.length > 0);

  return (
    <div className="flex flex-col gap-14">
      {sets.map(({ set, groups }) => (
        <section key={set} aria-labelledby={`set-${set}`}>
          <h2 id={`set-${set}`} className="mb-6 text-3xl font-extrabold tracking-tight">
            {SET_TITLES[set]}
            <span className="ml-3 align-middle text-base font-semibold text-muted-foreground">{set}</span>
          </h2>
          <div className="flex flex-col gap-10">
            {groups.map(({ group, algs: groupAlgs }) => (
              <div key={group}>
                <h3 className="mb-3 border-b border-border pb-2 text-lg font-bold">
                  {group}
                  <span className="ml-2 text-sm font-medium text-muted-foreground tabular-nums">{groupAlgs.length}</span>
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))]">
                  {groupAlgs.map((alg) => (
                    <AlgCard key={alg.id} alg={alg} entry={entryFor(progress, alg.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** One square per algorithm, coloured by status: progress read like a cube face. */
function ProgressBoard({ progress }: { progress: Progress }) {
  return (
    <div className="flex flex-col gap-4">
      {SETS.map((set) => {
        const algs = ALGS.filter((a) => a.set === set);
        const counts = { learning: 0, learned: 0 };
        for (const a of algs) {
          const s = entryFor(progress, a.id).status;
          if (s !== "unknown") counts[s]++;
        }
        return (
          <div key={set}>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-bold">{set}</span>
              <span className="text-muted-foreground tabular-nums">
                {counts.learned} learned, {counts.learning} in progress, of {algs.length}
              </span>
            </div>
            {/* Three rows each, at the same sticker size: OLL 19 wide, F2L 14 (41 leaves one gap), PLL 7. */}
            <div
              className="grid gap-[3px] rounded-md bg-foreground p-[3px]"
              style={{
                gridTemplateColumns: `repeat(${Math.ceil(algs.length / 3)}, minmax(0, 1fr))`,
                width: `${(Math.ceil(algs.length / 3) / 19) * 100}%`,
              }}
            >
              {algs.map((a) => (
                <span
                  key={a.id}
                  title={`${a.name}: ${STATUS_LABELS[entryFor(progress, a.id).status]}`}
                  className={cn("aspect-square rounded-[2px] transition-colors duration-300", SWATCH[entryFor(progress, a.id).status])}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex gap-4 text-xs text-muted-foreground">
        {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-[2px] ring-1 ring-foreground/20", SWATCH[s])} />
            {STATUS_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
