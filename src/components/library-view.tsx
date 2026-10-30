"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";
import { algsOf, GROUPS, SET_TITLES, type Alg, type AlgSet } from "@/data/algs";
import { AlgCard } from "@/components/algs/alg-card";
import { PuzzleSelect } from "@/components/puzzle-select";
import { SetSelect } from "@/components/set-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { libraryPageCount, saveLibraryPageCount, saveLibrarySpot, takeLibraryScroll } from "@/lib/library-return";
import { entryFor, STATUS_LABELS, useProgress, type Progress, type Status } from "@/lib/progress";
import { setPuzzle, usePuzzle } from "@/lib/puzzle-choice";
import { HEADLINES, PUZZLE_NAMES, PUZZLES, setLabel, setsOf, type Puzzle } from "@/lib/puzzles";
import { cn } from "@/lib/utils";
import { PageIntro } from "@/components/page-intro";

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

const bareName = (alg: Alg) =>
  alg.name.toLowerCase().replace(new RegExp(`^${setLabel(alg.set).toLowerCase()}\\s+`), "").replace(/ perm$/, "");

/** Search matcher over one puzzle's cases. A query naming a case ("21", "t perm", "j") shows just those cases. */
function makeMatcher(query: string, algs: Alg[]): (alg: Alg) => boolean {
  const raw = query.replace(/\s+/g, " ").trim();
  if (!raw) return () => true;
  const q = raw.toLowerCase();
  // "oll 21" means that case only; a bare "21" matches both F2L 21 and OLL 21.
  const prefix = [...new Set(algs.map((a) => setLabel(a.set)))].sort((a, b) => b.length - a.length)
    .find((label) => q === label.toLowerCase() || q.startsWith(`${label.toLowerCase()} `));
  const inSet = (a: Alg) => !prefix || setLabel(a.set).toUpperCase() === prefix.toUpperCase();
  const bare = (prefix ? q.slice(prefix.length).trim() : q).replace(/\s*perm$/, "");
  if (prefix && !bare) return inSet;
  if (algs.some((a) => inSet(a) && bareName(a) === bare)) return (a) => inSet(a) && bareName(a) === bare;
  // "j" or "g" means the J or G perms, not every shape with that letter in it.
  if (/^[a-z]$/.test(bare) && algs.some((a) => a.set === "PLL" && bareName(a).startsWith(bare))) {
    return (a) => a.set === "PLL" && bareName(a).startsWith(bare);
  }
  return (a) =>
    a.name.toLowerCase().includes(q) ||
    a.group.toLowerCase().includes(q) ||
    // Notation is case-sensitive: r is a wide move, R is not.
    a.algs.some((alg) => alg.includes(raw));
}

type Filters = { puzzle?: Puzzle; query: string; set: SetFilter; status: StatusFilter; group: string };

const DEFAULT_FILTERS: Filters = { query: "", set: "all", status: "all", group: "all" };

/** Filters from the URL (`?puzzle=&q=&set=&status=&shape=`), ignoring values that don't exist. */
function readFilters(params: URLSearchParams): Filters {
  const puzzle = PUZZLES.find((p) => p === params.get("puzzle"));
  const SETS = puzzle ? setsOf(puzzle) : PUZZLES.flatMap(setsOf);
  const set = SETS.find((s) => s === params.get("set")) ?? "all";
  const status = (Object.keys(STATUS_LABELS) as Status[]).find((s) => s === params.get("status")) ?? "all";
  const shape = params.get("shape") ?? "";
  const [shapeSet, shapeGroup] = shape.split(/:(.*)/);
  const validShape =
    SETS.some((s) => s === shapeSet && (set === "all" || set === s) && GROUPS[s].includes(shapeGroup ?? ""));
  return { puzzle, query: params.get("q") ?? "", set, status, group: validShape ? shape : "all" };
}

function writeFilters({ puzzle, query, set, status, group }: Filters) {
  const params = new URLSearchParams();
  if (puzzle && puzzle !== "3x3") params.set("puzzle", puzzle);
  if (query) params.set("q", query);
  if (set !== "all") params.set("set", set);
  if (status !== "all") params.set("status", status);
  if (group !== "all") params.set("shape", group);
  const search = params.toString();
  const url = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
  if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    // Replace, not push, so Back leaves the Library instead of stepping through filters.
    window.history.replaceState(window.history.state, "", url);
  }
}

/** The Library with its filters kept in the URL, so they survive a refresh or going back. */
export function LibraryFromUrl() {
  const params = useSearchParams();
  return <LibraryView initial={readFilters(new URLSearchParams(params.toString()))} syncUrl />;
}

export function LibraryView({ initial = DEFAULT_FILTERS, syncUrl = false }: { initial?: Filters; syncUrl?: boolean }) {
  const progress = useProgress();
  const puzzle = usePuzzle();
  const [query, setQuery] = useState(initial.query);
  const [chosenSet, setSet] = useState<SetFilter>(initial.set);
  const [status, setStatusFilter] = useState<StatusFilter>(initial.status);
  const [chosenGroup, setGroup] = useState(initial.group);
  const [page, setPage] = useState({ key: "", count: 60 });
  const deferredQuery = useDeferredValue(query);
  const sets = setsOf(puzzle);
  // A set or shape from another puzzle (an old link, or the puzzle changed elsewhere) means no filter.
  const set: SetFilter = chosenSet !== "all" && sets.includes(chosenSet) ? chosenSet : "all";
  const group = sets.some((s) => chosenGroup.startsWith(`${s}:`)) ? chosenGroup : "all";
  const puzzleAlgs = algsOf(puzzle);

  // A link with ?puzzle= picks that puzzle for every page.
  useEffect(() => {
    if (initial.puzzle) setPuzzle(initial.puzzle);
  }, [initial.puzzle]);

  // Back to library from a case puts you where you were; keep that spot up to date as you scroll.
  useEffect(() => {
    if (!syncUrl) return;
    const count = libraryPageCount();
    if (count > 60) setPage({ key: [puzzle, deferredQuery, set, status, group].join("|"), count });
    const y = takeLibraryScroll();
    const restoreFrame = y !== null ? requestAnimationFrame(() => window.scrollTo(0, y)) : 0;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(restoreFrame);
      frame = requestAnimationFrame(saveLibrarySpot);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [syncUrl]);

  useEffect(() => {
    if (!syncUrl) return;
    writeFilters({ puzzle, query: deferredQuery, set, status, group });
    saveLibrarySpot();
  }, [syncUrl, puzzle, deferredQuery, set, status, group]);

  function choosePuzzle(next: Puzzle) {
    setPuzzle(next);
    setSet("all");
    setGroup("all");
  }

  const groupItems = useMemo(() => {
    const inView: AlgSet[] = set === "all" ? setsOf(puzzle) : [set];
    return [
      { value: "all", label: "Any shape" },
      ...inView.flatMap((s) =>
        GROUPS[s].map((g) => ({ value: `${s}:${g}`, label: set === "all" && inView.length > 1 ? `${g} (${setLabel(s)})` : g })),
      ),
    ];
  }, [set, puzzle]);

  const matches = makeMatcher(deferredQuery, puzzleAlgs);
  const visible = puzzleAlgs.filter(
    (a) =>
      (set === "all" || a.set === set) &&
      (status === "all" || entryFor(progress, a.id).status === status) &&
      (group === "all" || `${a.set}:${a.group}` === group) &&
      matches(a),
  );
  const pageKey = [puzzle, deferredQuery, set, status, group].join("|");
  const shown = visible.slice(0, page.key === pageKey ? page.count : 60);

  const filtered = query !== "" || set !== "all" || status !== "all" || group !== "all";
  const clear = () => {
    setQuery("");
    setSet("all");
    setStatusFilter("all");
    setGroup("all");
  };

  return (
    <>
      <section className="mx-auto grid w-full max-w-7xl px-4 sm:px-6 gap-6 py-6 md:gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-end md:py-14">
        <div className="max-w-xl">
          <h1 className="text-[2rem] font-extrabold leading-[1.05] tracking-tight text-balance sm:text-5xl">{HEADLINES[puzzle]}</h1>
          <PageIntro>
            Mark a case <strong className="font-semibold text-foreground">In progress</strong> when you start learning it.
            In progress and Learned cases show up in Drill, with the ones you&apos;re still learning coming back most.
            Open a case to see every algorithm for it and pick the one you use.
          </PageIntro>
        </div>
        <ProgressBoard progress={progress} puzzle={puzzle} set={set} />
      </section>

      <div className="sticky top-(--header-h) z-30 mb-6 border-y border-border bg-background/90 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-4 sm:px-6">
          <PuzzleSelect value={puzzle} onChange={choosePuzzle} />
          <div className="relative min-w-0 flex-1 sm:min-w-52">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={puzzle === "3x3" ? "Search: OLL 21, T perm, R U R'…" : `Search ${PUZZLE_NAMES[puzzle]} cases or moves…`}
              aria-label="Search algorithms"
              className="h-9 pl-8"
            />
          </div>
          {/* Phones keep the bar to two rows: these scroll sideways under the search. */}
          <div className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden *:shrink-0 sm:contents">
            {sets.length > 6 ? <SetSelect puzzle={puzzle} value={set} all onChange={(v) => { setSet(v); setGroup("all"); }} /> : <ToggleGroup
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
              {(["all", ...sets] as const).map((s) => (
                <ToggleGroupItem key={s} value={s} className="px-3 font-semibold aria-pressed:bg-foreground aria-pressed:text-background">
                  {s === "all" ? "All" : setLabel(s)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>}
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
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6">
      <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
        Showing {shown.length} of {visible.length}{filtered && ` matching cases (${puzzleAlgs.length} total)`}
      </p>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <p className="font-semibold">No algorithms match these filters.</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a case name or number, a letter like T, or a move like R U R&apos;.</p>
          <Button variant="outline" className="mt-4" onClick={clear}>
            Clear filters
          </Button>
        </div>
      ) : (
        <Sections algs={shown} progress={progress} puzzle={puzzle} />
      )}
      {shown.length < visible.length && (
        <Button variant="outline" className="mt-8 w-full" onClick={() => {
          const count = shown.length + 60;
          setPage({ key: pageKey, count });
          if (syncUrl) saveLibraryPageCount(count);
        }}>
          Show more cases ({visible.length - shown.length} remaining)
        </Button>
      )}
      </div>
    </>
  );
}

function Sections({ algs, progress, puzzle }: { algs: Alg[]; progress: Progress; puzzle: Puzzle }) {
  const sets = setsOf(puzzle).map((set) => ({
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
            <span className="ml-3 align-middle text-base font-semibold text-muted-foreground">{setLabel(set)}</span>
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

const boardColumns = (n: number) => Math.ceil(n / Math.max(3, Math.ceil(n / 19)));

/** One square per algorithm, coloured by status: progress read like a cube face. */
function ProgressBoard({ progress, puzzle, set: selected }: { progress: Progress; puzzle: Puzzle; set: SetFilter }) {
  const sets = selected === "all" ? setsOf(puzzle) : [selected];
  const compact = selected === "all" && sets.length > 6;
  return (
    <div className="max-h-80 overflow-y-auto overscroll-contain pr-1" role="region" aria-label="Learning progress" tabIndex={0}>
    <div className={cn("grid gap-4", compact && "grid-cols-1 sm:grid-cols-2")}>
      {sets.map((set) => {
        const algs = algsOf(puzzle).filter((a) => a.set === set);
        const counts = { learning: 0, learned: 0 };
        for (const a of algs) {
          const s = entryFor(progress, a.id).status;
          if (s !== "unknown") counts[s]++;
        }
        return (
          <div key={set}>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-bold">{setLabel(set)}</span>
              <span className="text-muted-foreground tabular-nums">
                {compact ? `${counts.learned} / ${algs.length}` : `${counts.learned} learned, ${counts.learning} in progress, of ${algs.length}`}
              </span>
            </div>
            {/* Three rows each, at the same sticker size as the widest (3x3 OLL, 19 wide): F2L 14 (41 leaves one gap), PLL 7.
                Bigger sets (Square-1 cubeshape) add rows instead of growing wider. */}
            {compact ? <div className="flex h-2 overflow-hidden rounded-full bg-unknown" aria-label={`${setLabel(set)}: ${counts.learned} learned, ${counts.learning} in progress, of ${algs.length}`}>
              <span className="bg-learned" style={{ width: `${counts.learned / algs.length * 100}%` }} />
              <span className="bg-learning" style={{ width: `${counts.learning / algs.length * 100}%` }} />
            </div> : <div
              className="grid gap-[3px] rounded-md bg-foreground p-[3px]"
              style={{
                gridTemplateColumns: `repeat(${boardColumns(algs.length)}, minmax(0, 1fr))`,
                width: `${(boardColumns(algs.length) / 19) * 100}%`,
              }}
            >
              {algs.map((a) => (
                <span
                  key={a.id}
                  title={`${a.name}: ${STATUS_LABELS[entryFor(progress, a.id).status]}`}
                  className={cn("aspect-square rounded-[2px] transition-colors duration-300", SWATCH[entryFor(progress, a.id).status])}
                />
              ))}
            </div>}
          </div>
        );
      })}
    </div>
      <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
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
