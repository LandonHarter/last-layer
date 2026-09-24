"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { ALGS_BY_ID, SETS } from "@/data/algs";
import { GroupBarChart, HistogramChart, Legend, QQChart, TrendChart, type Fit, type GroupBar, type TrendLine } from "@/components/analyze/charts";
import { ChancesTest, CompareTest, NormalityTest, Panel, TrendTest, type Sample } from "@/components/analyze/tests";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { setStoredMode, useStoredMode, type Mode } from "@/lib/mode";
import { effectiveMs, formatMs, formatSolve, importTimerData, useDrillLog, useTimerData, type DrillAttempt, type Solve } from "@/lib/solves";
import {
  bestAverage,
  best as bestOf,
  linearRegression,
  mean,
  meanInterval,
  median,
  outlierMask,
  proportionInterval,
  rollingAverage,
  stdev,
  type OutlierRule,
} from "@/lib/stats";
import { cn } from "@/lib/utils";

const TOGGLE_ITEM = "px-2.5 aria-pressed:bg-foreground aria-pressed:text-background";

const RANGES = [
  { value: "all", label: "All time" },
  { value: "n50", label: "Latest 50" },
  { value: "n100", label: "Latest 100" },
  { value: "n500", label: "Latest 500" },
  { value: "n1000", label: "Latest 1000" },
  { value: "d7", label: "Last 7 days" },
  { value: "d30", label: "Last 30 days" },
  { value: "d90", label: "Last 90 days" },
];

const OUTLIERS: { value: string; label: string; rule: OutlierRule }[] = [
  { value: "none", label: "Keep all times", rule: { kind: "none" } },
  { value: "iqr15", label: "Beyond 1.5 IQR (Tukey)", rule: { kind: "iqr", k: 1.5 } },
  { value: "iqr3", label: "Beyond 3 IQR (far out)", rule: { kind: "iqr", k: 3 } },
  { value: "z3", label: "More than 3σ from mean", rule: { kind: "z", k: 3 } },
  { value: "z2", label: "More than 2σ from mean", rule: { kind: "z", k: 2 } },
  { value: "mad", label: "More than 3.5 MADs (robust)", rule: { kind: "mad", k: 3.5 } },
  { value: "trim5", label: "Fastest and slowest 5%", rule: { kind: "trim", pct: 5 } },
];

function inRange<T extends { at: number }>(items: T[], range: string): T[] {
  if (range === "all") return items;
  const k = Number(range.slice(1));
  if (range.startsWith("n")) return items.slice(-k);
  const since = Date.now() - k * 86400000;
  return items.filter((i) => i.at >= since);
}

const dateTime = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const monthFmt = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYPARTS = ["Night", "Morning", "Afternoon", "Evening"];

function timeGroups(at: number): Record<string, string> {
  const d = new Date(at);
  return {
    "Time of day": DAYPARTS[Math.floor(d.getHours() / 6)],
    Weekday: WEEKDAYS[(d.getDay() + 6) % 7],
    Month: monthFmt.format(d),
  };
}

/** Sort a dimension's values in their natural order. */
function orderFor(dim: string, values: string[], samples: Sample[]): string[] {
  if (dim === "Time of day") return DAYPARTS.filter((v) => values.includes(v));
  if (dim === "Weekday") return WEEKDAYS.filter((v) => values.includes(v));
  if (dim === "Set") return SETS.filter((v) => values.includes(v));
  // Everything else by first appearance, which is chronological for sessions and months.
  const first = new Map<string, number>();
  for (const s of samples) if (!first.has(s.groups[dim])) first.set(s.groups[dim], s.at);
  return [...values].sort((a, b) => (first.get(a) ?? 0) - (first.get(b) ?? 0));
}

const seconds = (ms: number) => formatMs(ms);

// ---------------------------------------------------------------------------

export function AnalyzeView() {
  const mode = useStoredMode();
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">Analyze</h1>
          <p className="mt-3 max-w-prose text-base leading-relaxed text-muted-foreground">
            {mode === "timer"
              ? "Every solve you've timed, with its scramble. Filter it, chart it and test it."
              : "Every answer you've given in a drill: how long it took and whether you got it."}
          </p>
        </div>
        <ToggleGroup value={[mode]} onValueChange={(v) => v[0] && setStoredMode(v[0] as Mode)} variant="outline" spacing={0} aria-label="Data to analyze">
          <ToggleGroupItem value="timer" className={cn(TOGGLE_ITEM, "px-3 font-semibold")}>
            Timer solves
          </ToggleGroupItem>
          <ToggleGroupItem value="algs" className={cn(TOGGLE_ITEM, "px-3 font-semibold")}>
            Algorithm drills
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {mode === "timer" ? <TimerAnalysis /> : <DrillAnalysis />}
    </div>
  );
}

function FilterSelect({ label, value, items, onChange, className }: { label: string; value: string; items: { value: string; label: string }[]; onChange: (v: string) => void; className?: string }) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className={cn("h-9 min-w-36", className)} aria-label={label}>
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

function FilterBar({ children, summary }: { children: React.ReactNode; summary: string }) {
  return (
    <div className="sticky top-14 z-30 -mx-4 flex flex-wrap items-center gap-2 border-b border-border bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      {children}
      <p className="ml-auto text-sm text-muted-foreground tabular-nums" aria-live="polite">
        {summary}
      </p>
    </div>
  );
}

function Empty({ text, href, action }: { text: string; href: string; action: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6">
      <p className="text-base text-muted-foreground">{text}</p>
      <Link href={href} className={buttonVariants({ size: "lg" })}>
        {action}
      </Link>
    </div>
  );
}

/** Apply the outlier rule to finite values only; DNFs are never outliers. */
function markOutliers(samples: Omit<Sample, "excluded">[], rule: OutlierRule): Sample[] {
  const mask = outlierMask(
    samples.map((s) => s.value),
    rule,
  );
  return samples.map((s, i) => ({ ...s, excluded: !mask[i] }));
}

// ---------------------------------------------------------------------------
// Timer

function TimerAnalysis() {
  const data = useTimerData();
  const [session, setSession] = useState("all");
  const [range, setRange] = useState("all");
  const [outliers, setOutliers] = useState("none");

  const sessionName = useMemo(() => new Map(data.sessions.map((s) => [s.id, s.name])), [data.sessions]);
  const solves = useMemo(() => {
    const picked = data.solves.filter((s) => session === "all" || s.session === session).sort((a, b) => a.at - b.at);
    return inRange(picked, range);
  }, [data.solves, session, range]);

  const rule = OUTLIERS.find((o) => o.value === outliers)!.rule;
  const samples = useMemo(
    () =>
      markOutliers(
        solves.map((s, i) => ({
          value: effectiveMs(s),
          at: s.at,
          n: i + 1,
          title: `Solve ${i + 1}, ${dateTime.format(s.at)}`,
          groups: { Session: sessionName.get(s.session) ?? "Deleted session", ...timeGroups(s.at) },
        })),
        rule,
      ),
    [solves, sessionName, rule],
  );

  if (!data.solves.length) return <Empty text="No solves yet. Time a few and they'll show up here." href="/timer" action="Open the Timer" />;

  const excluded = samples.filter((s) => s.excluded).length;
  const sessionItems = [{ value: "all", label: "All sessions" }, ...data.sessions.map((s) => ({ value: s.id, label: s.name }))];

  return (
    <>
      <FilterBar summary={`${samples.length} solves${excluded ? `, ${excluded} left out as outliers` : ""}`}>
        <FilterSelect label="Session" value={session} items={sessionItems} onChange={setSession} />
        <FilterSelect label="Range" value={range} items={RANGES} onChange={setRange} />
        <FilterSelect label="Outliers" value={outliers} items={OUTLIERS} onChange={setOutliers} className="min-w-52" />
      </FilterBar>
      {samples.length === 0 ? (
        <p className="text-base text-muted-foreground">Nothing in this range. Try All time or another session.</p>
      ) : (
        <Analysis samples={samples} kind="timer" dimensions={["Session", "Time of day", "Weekday", "Month"]} />
      )}
      <SolveTable solves={solves} samples={samples} sessionName={sessionName} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Drills

function DrillAnalysis() {
  const log = useDrillLog();
  const [set, setSet] = useState("all");
  const [caseId, setCaseId] = useState("all");
  const [range, setRange] = useState("all");
  const [outliers, setOutliers] = useState("none");

  const bySet = useMemo(() => log.filter((a) => set === "all" || ALGS_BY_ID.get(a.id)?.set === set), [log, set]);
  const cases = useMemo(() => [...new Set(bySet.map((a) => a.id))].sort(), [bySet]);
  const attempts = useMemo(() => inRange(caseId === "all" ? bySet : bySet.filter((a) => a.id === caseId), range), [bySet, caseId, range]);

  const rule = OUTLIERS.find((o) => o.value === outliers)!.rule;
  const samples = useMemo(
    () =>
      markOutliers(
        attempts.map((a, i) => {
          const alg = ALGS_BY_ID.get(a.id);
          return {
            value: a.ms,
            at: a.at,
            n: i + 1,
            title: `${alg?.name ?? a.id}, ${a.ok ? "got it" : "missed"}, ${dateTime.format(a.at)}`,
            groups: {
              Set: alg?.set ?? "Unknown",
              Case: alg ? `${alg.set} ${alg.name}` : a.id,
              Result: a.ok ? "Got it" : "Missed",
              Revealed: a.revealed ? "Revealed" : "Not revealed",
              ...timeGroups(a.at),
            },
          };
        }),
        rule,
      ),
    [attempts, rule],
  );

  if (!log.length) return <Empty text="No drills logged yet. Every Missed and Got it from a drill shows up here." href="/drill" action="Start a drill" />;

  const excluded = samples.filter((s) => s.excluded).length;
  const caseItems = [{ value: "all", label: "All cases" }, ...cases.map((id) => ({ value: id, label: `${ALGS_BY_ID.get(id)?.set ?? ""} ${ALGS_BY_ID.get(id)?.name ?? id}` }))];

  return (
    <>
      <FilterBar summary={`${samples.length} answers${excluded ? `, ${excluded} left out as outliers` : ""}`}>
        <FilterSelect
          label="Set"
          value={set}
          items={[{ value: "all", label: "All sets" }, ...SETS.map((s) => ({ value: s, label: s }))]}
          onChange={(v) => {
            setSet(v);
            setCaseId("all");
          }}
          className="min-w-28"
        />
        <FilterSelect label="Case" value={cases.includes(caseId) ? caseId : "all"} items={caseItems} onChange={setCaseId} />
        <FilterSelect label="Range" value={range} items={RANGES} onChange={setRange} />
        <FilterSelect label="Outliers" value={outliers} items={OUTLIERS} onChange={setOutliers} className="min-w-52" />
      </FilterBar>
      {samples.length === 0 ? (
        <p className="text-base text-muted-foreground">Nothing matches. Try All time or another set.</p>
      ) : (
        <>
          <Analysis samples={samples} kind="drill" dimensions={["Set", "Case", "Result", "Revealed", "Time of day", "Weekday"]} />
          <CaseTable attempts={attempts} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared analysis: summary, charts and tests over a list of samples.

const TIMER_WINDOWS = [5, 12, 100];
const DRILL_WINDOWS = [10, 50];

const LINE_STYLES = [
  { stroke: "stroke-chart-2", swatch: "bg-chart-2" },
  { stroke: "stroke-chart-3", swatch: "bg-chart-3" },
  { stroke: "stroke-chart-4", swatch: "bg-chart-4" },
];

function Analysis({ samples, kind, dimensions }: { samples: Sample[]; kind: "timer" | "drill"; dimensions: string[] }) {
  const timer = kind === "timer";
  const unit = timer ? "solves" : "answers";
  const windows = timer ? TIMER_WINDOWS : DRILL_WINDOWS;

  const kept = useMemo(() => samples.filter((s) => !s.excluded), [samples]);
  const finite = useMemo(() => kept.map((s) => s.value).filter(Number.isFinite), [kept]);

  const [xMode, setXMode] = useState<"index" | "date">("index");
  const [logY, setLogY] = useState(false);
  const [showTrend, setShowTrend] = useState(true);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [fit, setFit] = useState<Fit>("normal");
  const [logQQ, setLogQQ] = useState(false);
  const [groupBy, setGroupBy] = useState(dimensions[0]);
  const [measure, setMeasure] = useState<"time" | "accuracy">("time");

  // Rolling averages skip outliers, then line up with every sample again.
  const lines: TrendLine[] = useMemo(() => {
    const keptValues = kept.map((s) => s.value);
    const position = new Map(kept.map((s, i) => [s, i]));
    return windows
      .map((w, i) => ({ w, i }))
      .filter(({ w, i }) => !hidden.has(w) && kept.length >= w && i < LINE_STYLES.length)
      .map(({ w, i }) => {
        const rolled = rollingAverage(keptValues, w);
        return {
          id: String(w),
          label: timer ? `ao${w}` : `Average of ${w}`,
          ...LINE_STYLES[i],
          values: samples.map((s) => (s.excluded ? null : rolled[position.get(s)!])),
        };
      });
  }, [kept, samples, hidden, timer, windows]);

  const trend = useMemo(() => {
    if (!showTrend) return null;
    const pts = kept.filter((s) => Number.isFinite(s.value));
    return linearRegression(
      pts.map((s) => (xMode === "index" ? s.n : s.at)),
      pts.map((s) => s.value),
    );
  }, [kept, showTrend, xMode]);

  const accuracyLine = useMemo(() => {
    if (timer) return null;
    const ok = samples.map((s) => (s.groups.Result === "Got it" ? 1 : 0));
    const w = Math.min(20, Math.max(5, Math.floor(samples.length / 4)));
    return {
      w,
      values: ok.map((_, i) => (i + 1 < w ? null : mean(ok.slice(i + 1 - w, i + 1)))),
    };
  }, [samples, timer]);

  const groups: GroupBar[] = useMemo(() => {
    const values = orderFor(groupBy, [...new Set(samples.map((s) => s.groups[groupBy]))], samples);
    return values.map((label) => {
      const inGroup = samples.filter((s) => s.groups[groupBy] === label);
      if (measure === "accuracy") {
        const got = inGroup.filter((s) => s.groups.Result === "Got it").length;
        const ci = proportionInterval(got, inGroup.length);
        return { label, value: ci.p, low: ci.low, high: ci.high, count: inGroup.length };
      }
      const xs = inGroup.filter((s) => !s.excluded && Number.isFinite(s.value)).map((s) => s.value);
      const ci = meanInterval(xs);
      return { label, value: xs.length ? ci.mean : 0, low: ci.low, high: ci.high, count: xs.length };
    });
  }, [samples, groupBy, measure]);

  const points = samples.map((s) => ({ x: xMode === "index" ? s.n : s.at, y: s.value, excluded: s.excluded, title: s.title }));
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="flex flex-col gap-10">
      <Summary samples={samples} finite={finite} timer={timer} />

      <section aria-labelledby="over-time" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="over-time" className="text-2xl font-extrabold tracking-tight">
            Over time
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup value={[xMode]} onValueChange={(v) => v[0] && setXMode(v[0] as "index" | "date")} variant="outline" size="sm" spacing={0} aria-label="Horizontal axis">
              <ToggleGroupItem value="index" className={TOGGLE_ITEM}>
                By {timer ? "solve" : "answer"}
              </ToggleGroupItem>
              <ToggleGroupItem value="date" className={TOGGLE_ITEM}>
                By date
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup value={[logY ? "log" : "linear"]} onValueChange={(v) => v[0] && setLogY(v[0] === "log")} variant="outline" size="sm" spacing={0} aria-label="Vertical scale">
              <ToggleGroupItem value="linear" className={TOGGLE_ITEM}>
                Linear
              </ToggleGroupItem>
              <ToggleGroupItem value="log" className={TOGGLE_ITEM}>
                Log
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        <Legend
          items={[
            { label: timer ? "Solve" : "Answer time", swatch: "bg-chart-1", kind: "dot" },
            ...windows.slice(0, LINE_STYLES.length).map((w, i) => ({
              label: timer ? `ao${w}` : `Average of ${w}`,
              swatch: LINE_STYLES[i].swatch,
              checked: !hidden.has(w),
              onToggle: () =>
                setHidden((h) => {
                  const next = new Set(h);
                  if (next.has(w)) next.delete(w);
                  else next.add(w);
                  return next;
                }),
            })),
            { label: "Trend", swatch: "bg-foreground/50", checked: showTrend, onToggle: () => setShowTrend((v) => !v) },
            ...(samples.some((s) => !Number.isFinite(s.value)) ? [{ label: "DNF, marked along the top", swatch: "bg-missed", kind: "bar" as const }] : []),
          ]}
        />
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <TrendChart
            points={points}
            lines={lines}
            trend={trend}
            xMode={xMode}
            logY={logY}
            valueFormat={seconds}
            label={timer ? "Solve times over time, in seconds" : "Answer times over time, in seconds"}
          />
        </div>
        {accuracyLine && (
          <>
            <h3 className="text-base font-extrabold tracking-tight">Share you got, over the last {accuracyLine.w} answers</h3>
            <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <TrendChart
                points={points}
                showPoints={false}
                lines={[{ id: "acc", label: "Got it", stroke: "stroke-chart-3", swatch: "bg-chart-3", values: accuracyLine.values }]}
                xMode={xMode}
                yDomain={[0, 1]}
                yFormat={pct}
                valueFormat={pct}
                height={200}
                label="Rolling share of answers you got"
              />
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="distribution" className="flex flex-col gap-4">
        <h2 id="distribution" className="text-2xl font-extrabold tracking-tight">
          Distribution
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="How your times spread"
            controls={
              <ToggleGroup value={[fit]} onValueChange={(v) => v[0] && setFit(v[0] as Fit)} variant="outline" size="sm" spacing={0} aria-label="Fitted curve">
                <ToggleGroupItem value="normal" className={TOGGLE_ITEM}>
                  Normal
                </ToggleGroupItem>
                <ToggleGroupItem value="lognormal" className={TOGGLE_ITEM}>
                  Log-normal
                </ToggleGroupItem>
                <ToggleGroupItem value="none" className={TOGGLE_ITEM}>
                  No curve
                </ToggleGroupItem>
              </ToggleGroup>
            }
          >
            <Legend
              items={[
                { label: timer ? "Solves per bin" : "Answers per bin", swatch: "bg-chart-1", kind: "bar" },
                ...(fit === "none" ? [] : [{ label: fit === "normal" ? "Normal curve" : "Log-normal curve", swatch: "bg-chart-2" }]),
              ]}
            />
            <HistogramChart values={finite} fit={fit} valueFormat={seconds} label="Histogram of times" />
          </Panel>
          <Panel title={logQQ ? "Log-normal Q-Q plot" : "Normal Q-Q plot"}>
            <p className="text-sm text-muted-foreground">
              Each dot is one time, placed against where it would fall on a perfect {logQQ ? "log-normal" : "bell"} curve. On the line means it fits;
              curling up at the right means a slow tail.
            </p>
            <QQChart values={finite} log={logQQ} valueFormat={seconds} label="Quantile-quantile plot against a normal distribution" />
          </Panel>
        </div>
      </section>

      <section aria-labelledby="tests" className="flex flex-col gap-4">
        <h2 id="tests" className="text-2xl font-extrabold tracking-tight">
          Tests
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <NormalityTest values={finite} log={logQQ} onLogChange={setLogQQ} format={seconds} />
          <TrendTest samples={samples} format={seconds} unit={unit} />
          <CompareTest samples={samples} dimensions={dimensions} format={seconds} unit={unit} />
          <ChancesTest pool={kept.map((s) => s.value)} format={seconds} averages={timer} />
        </div>
      </section>

      <section aria-labelledby="groups" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="groups" className="text-2xl font-extrabold tracking-tight">
            By group
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {!timer && (
              <ToggleGroup value={[measure]} onValueChange={(v) => v[0] && setMeasure(v[0] as "time" | "accuracy")} variant="outline" size="sm" spacing={0} aria-label="Measure">
                <ToggleGroupItem value="time" className={TOGGLE_ITEM}>
                  Answer time
                </ToggleGroupItem>
                <ToggleGroupItem value="accuracy" className={TOGGLE_ITEM}>
                  Got it
                </ToggleGroupItem>
              </ToggleGroup>
            )}
            <FilterSelect label="Group by" value={groupBy} items={dimensions.map((d) => ({ value: d, label: d }))} onChange={setGroupBy} className="h-8 min-w-32" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <p className="mb-2 text-sm text-muted-foreground">
            {measure === "accuracy" && !timer ? "Share you got in each group" : "Mean time in each group"}, with a 95% interval. Wide whiskers mean too few to be sure.
          </p>
          <GroupBarChart
            groups={groups}
            valueFormat={measure === "accuracy" && !timer ? pct : seconds}
            yFormat={measure === "accuracy" && !timer ? pct : undefined}
            yMax={measure === "accuracy" && !timer ? 1 : undefined}
            countLabel={unit}
            label={`By ${groupBy.toLowerCase()}`}
          />
        </div>
      </section>
    </div>
  );
}

function Summary({ samples, finite, timer }: { samples: Sample[]; finite: number[]; timer: boolean }) {
  const kept = samples.filter((s) => !s.excluded);
  const values = kept.map((s) => s.value);
  const dnfs = values.length - finite.length;
  const ci = meanInterval(finite);
  const sd = stdev(finite);

  if (!timer) {
    const got = samples.filter((s) => s.groups.Result === "Got it").length;
    const acc = proportionInterval(got, samples.length);
    const revealed = samples.filter((s) => s.groups.Revealed === "Revealed").length;
    const cases = new Set(samples.map((s) => s.groups.Case)).size;
    return (
      <SummaryLayout
        hero={`${Math.round(acc.p * 100)}%`}
        heroLabel="Got it"
        heroNote={samples.length > 1 ? `95% interval ${Math.round(acc.low * 100)}% to ${Math.round(acc.high * 100)}%` : ""}
        items={[
          ["Answers", String(samples.length)],
          ["Cases", String(cases)],
          ["Median answer time", formatMs(finite.length ? median(finite) : null)],
          ["Mean answer time", formatMs(ci.mean)],
          ["Revealed first", `${Math.round((revealed / samples.length) * 100)}%`],
          ["Spread (σ)", formatMs(sd)],
        ]}
      />
    );
  }

  const items: [string, string][] = [
    ["Solves", `${samples.length}${dnfs ? `, ${dnfs} DNF` : ""}`],
    ["Median", formatMs(finite.length ? median(finite) : null)],
    ["Best", formatMs(bestOf(values))],
    ["Worst", formatMs(finite.length ? Math.max(...finite) : null)],
    ["Spread (σ)", formatMs(sd)],
    ["Consistency", Number.isFinite(sd) ? `${((sd / ci.mean) * 100).toFixed(1)}% of mean` : "–"],
    ["Best ao5", formatMs(bestAverage(values, 5)?.value)],
    ["Best ao12", formatMs(bestAverage(values, 12)?.value)],
    ["Best ao100", formatMs(bestAverage(values, 100)?.value)],
  ];
  return (
    <SummaryLayout
      hero={formatMs(ci.mean)}
      heroLabel="Mean"
      heroNote={Number.isFinite(ci.low) ? `95% interval ${formatMs(ci.low)} to ${formatMs(ci.high)}` : ""}
      items={items}
    />
  );
}

function SummaryLayout({ hero, heroLabel, heroNote, items }: { hero: string; heroLabel: string; heroNote: string; items: [string, string][] }) {
  return (
    <section aria-label="Summary" className="grid items-center gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-14">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{heroLabel}</p>
        <p className="font-clock text-[clamp(4.5rem,11vw,8rem)] leading-[0.9]">{hero}</p>
        {heroNote && <p className="mt-2 text-sm text-muted-foreground tabular-nums">{heroNote}</p>}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="border-t border-border pt-2">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tables

const PAGE = 50;

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const csvCell = (v: string | number) => (typeof v === "number" ? String(v) : `"${v.replace(/"/g, '""')}"`);

function SolveTable({ solves, samples, sessionName }: { solves: Solve[]; samples: Sample[]; sessionName: Map<string, string> }) {
  const data = useTimerData();
  const log = useDrillLog();
  const [sort, setSort] = useState<"n" | "fast" | "slow">("n");
  const [page, setPage] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const r = solves.map((s, i) => ({ solve: s, sample: samples[i] }));
    if (sort === "n") return r.reverse();
    return r.sort((a, b) => (sort === "fast" ? a.sample.value - b.sample.value : b.sample.value - a.sample.value));
  }, [solves, samples, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);

  function exportCsv() {
    const header = ["n", "time_s", "penalty", "raw_ms", "finished", "session", "outlier", "scramble"];
    const lines = solves.map((s, i) =>
      [
        i + 1,
        Number.isFinite(samples[i].value) ? samples[i].value / 1000 : "DNF",
        s.penalty,
        s.ms,
        new Date(s.at).toISOString(),
        sessionName.get(s.session) ?? "",
        samples[i].excluded ? "yes" : "no",
        s.scramble,
      ].map(csvCell).join(","),
    );
    download("solves.csv", [header.join(","), ...lines].join("\n"), "text/csv");
  }

  function exportJson() {
    download("last-layer-backup.json", JSON.stringify({ version: 1, timer: data, drillLog: log }, null, 1), "application/json");
  }

  async function importJson(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      const timer = parsed.timer ?? parsed;
      if (!Array.isArray(timer.solves)) throw new Error("no solves");
      const valid = timer.solves.filter((s: Partial<Solve>) => typeof s.ms === "number" && typeof s.at === "number" && typeof s.id === "string");
      importTimerData({ solves: valid.map((s: Solve) => ({ ...s, penalty: s.penalty ?? "none", scramble: s.scramble ?? "", session: s.session ?? "main" })), sessions: timer.sessions });
      toast(`Imported ${valid.length} solves`, { description: "Solves you already had were skipped." });
    } catch {
      toast("Couldn't import that file", { description: "Pick a backup saved from Analyze with Save backup." });
    }
  }

  return (
    <section aria-labelledby="all-solves" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="all-solves" className="text-2xl font-extrabold tracking-tight">
          Solves
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup value={[sort]} onValueChange={(v) => v[0] && setSort(v[0] as "n" | "fast" | "slow")} variant="outline" size="sm" spacing={0} aria-label="Sort solves">
            <ToggleGroupItem value="n" className={TOGGLE_ITEM}>
              Newest
            </ToggleGroupItem>
            <ToggleGroupItem value="fast" className={TOGGLE_ITEM}>
              Fastest
            </ToggleGroupItem>
            <ToggleGroupItem value="slow" className={TOGGLE_ITEM}>
              Slowest
            </ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!solves.length}>
            <DownloadIcon data-icon="inline-start" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportJson}>
            <DownloadIcon data-icon="inline-start" />
            Save backup
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <UploadIcon data-icon="inline-start" />
            Import backup
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[40rem] text-sm tabular-nums">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-medium">#</th>
                <th scope="col" className="px-4 py-2 font-medium">Time</th>
                <th scope="col" className="px-4 py-2 font-medium">Finished</th>
                <th scope="col" className="px-4 py-2 font-medium">Session</th>
                <th scope="col" className="px-4 py-2 font-medium">Scramble</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(current * PAGE, current * PAGE + PAGE).map(({ solve, sample }) => (
                <tr key={solve.id} className={cn("border-b border-border last:border-0", sample.excluded && "text-muted-foreground")}>
                  <td className="px-4 py-2 text-muted-foreground">{sample.n}</td>
                  <td className="px-4 py-2 font-semibold whitespace-nowrap">
                    {formatSolve(solve)}
                    {sample.excluded && <span className="ml-2 text-xs font-normal">outlier</span>}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{dateTime.format(solve.at)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{sessionName.get(solve.session) ?? ""}</td>
                  <td className="px-4 py-2 font-mono text-xs">{solve.scramble}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Newer
          </Button>
          <span className="tabular-nums">
            Page {current + 1} of {pages}
          </span>
          <Button variant="outline" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            Older
          </Button>
        </div>
      )}
    </section>
  );
}

function CaseTable({ attempts }: { attempts: DrillAttempt[] }) {
  const [sort, setSort] = useState<"accuracy" | "time" | "count">("accuracy");
  const rows = useMemo(() => {
    const by = new Map<string, DrillAttempt[]>();
    for (const a of attempts) by.set(a.id, [...(by.get(a.id) ?? []), a]);
    const r = [...by].map(([id, list]) => ({
      id,
      alg: ALGS_BY_ID.get(id),
      count: list.length,
      accuracy: list.filter((a) => a.ok).length / list.length,
      median: median(list.map((a) => a.ms)),
      last: Math.max(...list.map((a) => a.at)),
    }));
    return r.sort((a, b) => (sort === "accuracy" ? a.accuracy - b.accuracy || b.count - a.count : sort === "time" ? b.median - a.median : b.count - a.count));
  }, [attempts, sort]);

  return (
    <section aria-labelledby="cases" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cases" className="text-2xl font-extrabold tracking-tight">
          Cases
        </h2>
        <ToggleGroup value={[sort]} onValueChange={(v) => v[0] && setSort(v[0] as "accuracy" | "time" | "count")} variant="outline" size="sm" spacing={0} aria-label="Sort cases">
          <ToggleGroupItem value="accuracy" className={TOGGLE_ITEM}>
            Most missed
          </ToggleGroupItem>
          <ToggleGroupItem value="time" className={TOGGLE_ITEM}>
            Slowest
          </ToggleGroupItem>
          <ToggleGroupItem value="count" className={TOGGLE_ITEM}>
            Most drilled
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[34rem] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th scope="col" className="px-4 py-2 font-medium">Case</th>
              <th scope="col" className="px-4 py-2 font-medium">Answers</th>
              <th scope="col" className="px-4 py-2 font-medium">Got it</th>
              <th scope="col" className="px-4 py-2 font-medium">Median time</th>
              <th scope="col" className="px-4 py-2 font-medium">Last drilled</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-semibold">
                  <Link href={`/algs/${r.id}`} className="underline-offset-4 hover:underline">
                    {r.alg ? `${r.alg.set} ${r.alg.name}` : r.id}
                  </Link>
                </td>
                <td className="px-4 py-2">{r.count}</td>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <span className="block h-full rounded-full bg-learned" style={{ width: `${r.accuracy * 100}%` }} />
                    </span>
                    {Math.round(r.accuracy * 100)}%
                  </span>
                </td>
                <td className="px-4 py-2">{formatMs(r.median)}</td>
                <td className="px-4 py-2 whitespace-nowrap">{dateTime.format(r.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
