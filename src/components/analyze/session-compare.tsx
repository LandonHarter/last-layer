"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Figures, Panel, pValue, Verdict } from "@/components/analyze/tests";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { effectiveMs, formatMs, sessionPuzzle, type Session, type Solve } from "@/lib/solves";
import { TIMER_PUZZLE_NAMES } from "@/lib/scramble";
import {
  bestAverage,
  best as bestOf,
  brownForsythe,
  ksTest,
  mannWhitneyU,
  mean,
  median,
  outlierMask,
  permutationTest,
  stdev,
  studentTTest,
  welchTTest,
  type OutlierRule,
  type Sided,
} from "@/lib/stats";
import { cn } from "@/lib/utils";

type TestId = "welch" | "student" | "mw" | "median" | "ks" | "spread";
type Side = "two" | "a" | "b";

const TESTS: { value: TestId; label: string; what: string; checks: string; dnf: boolean }[] = [
  { value: "welch", label: "Means: Welch's t-test", what: "mean time", dnf: false, checks: "Whether the mean times differ. Doesn't assume both sessions are equally consistent; the usual pick." },
  { value: "student", label: "Means: Student's t-test", what: "mean time", dnf: false, checks: "Whether the mean times differ, assuming both sessions have the same spread." },
  { value: "mw", label: "Typical solve: Mann-Whitney U", what: "typical solve", dnf: true, checks: "Whether a solve from one session tends to beat one from the other. Uses ranks, so one bad solve barely moves it." },
  { value: "median", label: "Medians: permutation test", what: "median", dnf: false, checks: "Whether the medians differ, by shuffling which session each solve came from 4000 times. No curve assumed." },
  { value: "ks", label: "Whole spread of times: Kolmogorov-Smirnov", what: "spread of times", dnf: true, checks: "Whether the times come from different distributions at all: faster, slower, or just shaped differently." },
  { value: "spread", label: "Consistency: Brown-Forsythe", what: "consistency", dnf: false, checks: "Whether one session is more consistent, from how far each solve lands from its session's median." },
];

const ALPHAS = [
  { value: "0.1", label: "Significance 10%" },
  { value: "0.05", label: "Significance 5%" },
  { value: "0.01", label: "Significance 1%" },
];

const signed = (ms: number) => `${ms < 0 ? "−" : "+"}${formatMs(Math.abs(ms))}`;

type Run = Sided & { figures: [string, ReactNode][]; /** Negative when the first session is ahead (faster or more consistent). */ lean: number; size: string };

function runTest(test: TestId, a: number[], b: number[], aName: string, bName: string): Run | null {
  const fa = a.filter(Number.isFinite);
  const fb = b.filter(Number.isFinite);
  if (test === "welch" || test === "student") {
    const r = test === "welch" ? welchTTest(fa, fb) : studentTTest(fa, fb);
    if (!r) return null;
    return {
      ...r,
      lean: r.diff,
      size: `${formatMs(Math.abs(r.diff))} s`,
      figures: [
        ["Difference in means", `${signed(r.diff)} s`],
        ["95% interval", `${signed(r.low)} to ${signed(r.high)} s`],
        ["t", `${r.t.toFixed(2)} (df ${r.df.toFixed(0)})`],
      ],
    };
  }
  if (test === "mw") {
    const r = mannWhitneyU(a, b);
    if (!r) return null;
    return {
      ...r,
      lean: 0.5 - r.superiority,
      size: "",
      figures: [
        [`${aName} beats ${bName}`, `${(r.superiority * 100).toFixed(0)}% of pairs`],
        ["U", r.u.toFixed(1)],
        ["z", r.z.toFixed(2)],
      ],
    };
  }
  if (test === "median") {
    const r = permutationTest(fa, fb, median, 4000, fa.length + fb.length);
    if (!r) return null;
    return {
      ...r,
      lean: r.diff,
      size: `${formatMs(Math.abs(r.diff))} s`,
      figures: [
        ["Difference in medians", `${signed(r.diff)} s`],
        ["95% interval, bootstrap", `${signed(r.low)} to ${signed(r.high)} s`],
      ],
    };
  }
  if (test === "ks") {
    const r = ksTest(a, b);
    if (!r) return null;
    return {
      ...r,
      lean: r.dGreater - r.dLess,
      size: "",
      figures: [
        ["Largest gap D", r.d.toFixed(3)],
        [`${aName} ahead by up to`, `${(r.dLess * 100).toFixed(0)}% of solves`],
        [`${bName} ahead by up to`, `${(r.dGreater * 100).toFixed(0)}% of solves`],
      ],
    };
  }
  const r = brownForsythe(fa, fb);
  if (!r) return null;
  return {
    ...r,
    lean: r.spreadA - r.spreadB,
    size: `${formatMs(Math.abs(r.spreadA - r.spreadB))} s`,
    figures: [
      [`${aName}, average miss from median`, `${formatMs(r.spreadA)} s`],
      [`${bName}, average miss from median`, `${formatMs(r.spreadB)} s`],
      ["F", `${r.f.toFixed(2)} (1, ${r.df})`],
    ],
  };
}

const sideP = (r: Sided, side: Side) => (side === "two" ? r.p : side === "a" ? r.less : r.greater);

/** Faster for times, more consistent for spread. */
const better = (test: TestId) => (test === "spread" ? "more consistent" : "faster");

function sentence(test: TestId, run: Run, side: Side, alpha: number, aName: string, bName: string): ReactNode {
  const info = TESTS.find((t) => t.value === test)!;
  const p = sideP(run, side);
  const word = better(test);
  const ahead = run.lean < 0 ? aName : bName;
  const by = run.size ? ` by ${run.size}` : "";
  const level = `${alpha * 100}% level`;
  if (side === "two") {
    if (run.lean === 0 && p >= alpha) return <>No difference in {info.what} at all here ({pValue(p)}).</>;
    return p < alpha ? (
      <>
        {ahead} is {word}
        {by}, and a gap in {info.what} this big is unlikely to be chance ({pValue(p)}, significant at the {level}).
      </>
    ) : (
      <>
        {ahead} looks {word}
        {by}, but that could easily be chance ({pValue(p)}, not significant at the {level}). More solves would tell.
      </>
    );
  }
  const claim = side === "a" ? aName : bName;
  const other = side === "a" ? bName : aName;
  if (p < alpha)
    return (
      <>
        Yes: {claim} is {word} than {other}
        {by} ({pValue(p)}, significant at the {level}).
      </>
    );
  return (
    <>
      Can&apos;t say {claim} is {word} than {other} ({pValue(p)}, not significant at the {level}).
      {ahead !== claim && run.lean !== 0 && ` If anything, ${ahead} is ${word} here.`}
    </>
  );
}

function Pick({ value, items, onChange, label, className }: { value: string; items: { value: string; label: string }[]; onChange: (v: string) => void; label: string; className?: string }) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger size="sm" aria-label={label} className={cn("max-w-56", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Two sessions side by side, and a test of your choice on whether they really differ.
 * Takes solves already narrowed by case and range; outliers come out per session.
 */
export function SessionCompare({ solves, sessions, current, rule }: { solves: Solve[]; sessions: Session[]; current: string; rule: OutlierRule }) {
  const bySession = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const s of solves) {
      const list = m.get(s.session) ?? [];
      list.push(effectiveMs(s));
      m.set(s.session, list);
    }
    for (const [id, xs] of m) {
      const keep = outlierMask(xs, rule);
      m.set(
        id,
        xs.filter((_, i) => keep[i]),
      );
    }
    return m;
  }, [solves, rule]);

  const withSolves = sessions.filter((s) => (bySession.get(s.id)?.length ?? 0) > 0);
  const items = withSolves.map((s) => ({ value: s.id, label: s.name }));
  const [aPick, setA] = useState<string | null>(null);
  const [bPick, setB] = useState<string | null>(null);
  const [test, setTest] = useState<TestId | "all">("welch");
  const [side, setSide] = useState<Side>("two");
  const [alpha, setAlpha] = useState("0.05");

  const ids = withSolves.map((s) => s.id);
  const a = aPick && ids.includes(aPick) ? aPick : ids.includes(current) ? current : ids[0];
  const b = bPick && ids.includes(bPick) && bPick !== a ? bPick : ids.find((id) => id !== a);
  const sa = sessions.find((s) => s.id === a);
  const sb = sessions.find((s) => s.id === b);
  const aName = sa?.name ?? "";
  const bName = sb?.name ?? "";
  const av = useMemo(() => (a ? (bySession.get(a) ?? []) : []), [bySession, a]);
  const bv = useMemo(() => (b ? (bySession.get(b) ?? []) : []), [bySession, b]);
  const level = Number(alpha);

  const runs = useMemo(() => {
    const out = new Map<TestId, Run | null>();
    if (!a || !b) return out;
    for (const t of TESTS) if (test === "all" || test === t.value) out.set(t.value, runTest(t.value, av, bv, aName, bName));
    return out;
  }, [a, b, av, bv, aName, bName, test]);

  if (withSolves.length < 2 || !a || !b || !sa || !sb) {
    return (
      <Panel title="Compare two sessions">
        <p className="text-sm text-muted-foreground">Needs solves in two sessions. Start a new session on the Timer, then come back to compare.</p>
      </Panel>
    );
  }

  const word = test === "spread" ? "more consistent" : test === "all" ? "ahead" : "faster";
  const sides = [
    { value: "two", label: "Any difference" },
    { value: "a", label: `${aName} is ${word}` },
    { value: "b", label: `${bName} is ${word}` },
  ];
  const testItems = [...TESTS.map(({ value, label }) => ({ value, label })), { value: "all", label: "All tests at once" }];
  const info = TESTS.find((t) => t.value === test);
  const run = test === "all" ? null : runs.get(test);
  const puzzleA = sessionPuzzle(sa);
  const puzzleB = sessionPuzzle(sb);

  return (
    <Panel title="Compare two sessions">
      <div className="flex flex-wrap items-center gap-2">
        <Pick value={a} items={items} onChange={setA} label="First session" />
        <span className="text-sm text-muted-foreground">and</span>
        <Pick value={b} items={items.filter((i) => i.value !== a)} onChange={setB} label="Second session" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Pick value={test} items={testItems} onChange={(v) => setTest(v as TestId | "all")} label="Test to run" className="max-w-72" />
        <Pick value={side} items={sides} onChange={(v) => setSide(v as Side)} label="What to look for" className="max-w-64" />
        <Pick value={alpha} items={ALPHAS} onChange={setAlpha} label="Significance level" />
      </div>

      <SideBySide a={av} b={bv} aName={aName} bName={bName} aPuzzle={TIMER_PUZZLE_NAMES[puzzleA]} bPuzzle={TIMER_PUZZLE_NAMES[puzzleB]} />
      {puzzleA !== puzzleB && <p className="text-sm text-missed">These sessions are different puzzles, so a difference is expected.</p>}

      {test === "all" ? (
        <AllTests runs={runs} side={side} alpha={level} />
      ) : (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            {info!.checks} {info!.dnf ? "DNFs count as the slowest times." : "DNFs are left out."}
          </p>
          {!run ? (
            <p className="text-sm text-muted-foreground">Each session needs at least {test === "ks" ? 5 : test === "welch" || test === "student" ? 2 : 3} times with some spread.</p>
          ) : (
            <>
              <Figures items={[...run.figures, ["p-value", pValue(sideP(run, side))]]} />
              <Verdict>
                {sentence(test, run, side, level, aName, bName)}
                {test === "mw" && Math.min(av.length, bv.length) < 10 && " With under 10 solves in a session the p-value is rough."}
              </Verdict>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

function SideBySide({ a, b, aName, bName, aPuzzle, bPuzzle }: { a: number[]; b: number[]; aName: string; bName: string; aPuzzle: string; bPuzzle: string }) {
  const row = (xs: number[]) => {
    const f = xs.filter(Number.isFinite);
    const dnfs = xs.length - f.length;
    const ao = (n: number) => (xs.length >= n ? formatMs(bestAverage(xs, n)?.value ?? Infinity) : "–");
    return [
      `${xs.length}${dnfs ? `, ${dnfs} DNF` : ""}`,
      f.length ? formatMs(mean(f)) : "–",
      f.length ? formatMs(median(f)) : "–",
      f.length > 1 ? formatMs(stdev(f)) : "–",
      xs.length ? formatMs(bestOf(xs) ?? Infinity) : "–",
      ao(5),
      ao(12),
    ];
  };
  const labels = ["Solves", "Mean", "Median", "Standard deviation", "Best", "Best ao5", "Best ao12"];
  const ra = row(a);
  const rb = row(b);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">
              <span className="sr-only">Figure</span>
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              {aName} <span className="font-normal">({aPuzzle})</span>
            </th>
            <th scope="col" className="py-2 font-medium">
              {bName} <span className="font-normal">({bPuzzle})</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => (
            <tr key={l} className="border-b border-border last:border-0">
              <th scope="row" className="py-1.5 pr-4 text-left font-normal text-muted-foreground">
                {l}
              </th>
              <td className="py-1.5 pr-4 font-semibold">{ra[i]}</td>
              <td className="py-1.5 font-semibold">{rb[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AllTests({ runs, side, alpha }: { runs: Map<TestId, Run | null>; side: Side; alpha: number }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">Test</th>
              <th scope="col" className="py-2 pr-4 font-medium">p-value</th>
              <th scope="col" className="py-2 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {TESTS.map((t) => {
              const r = runs.get(t.value);
              const p = r ? sideP(r, side) : null;
              return (
                <tr key={t.value} className="border-b border-border last:border-0">
                  <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                    {t.label}
                  </th>
                  <td className="py-1.5 pr-4">{p === null ? "–" : pValue(p)}</td>
                  <td className={cn("py-1.5 font-semibold", p !== null && p < alpha && "text-learned")}>
                    {p === null ? "Not enough times" : p < alpha ? "Significant" : "Not significant"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        Running many tests makes one come up significant by chance more often. Pick the one that matches your question; the mean and typical-solve tests are the usual
        ones.
      </p>
    </div>
  );
}
