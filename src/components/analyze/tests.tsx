"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  averageOf,
  kurtosis,
  linearRegression,
  mean,
  normalCdf,
  quantile,
  shapiroWilk,
  skewness,
  stdev,
  welchTTest,
} from "@/lib/stats";
import { cn } from "@/lib/utils";

/** One value in an analysis: a solve time, or a drill answer time. */
export type Sample = {
  /** ms; Infinity for a DNF. */
  value: number;
  at: number;
  /** 1-based position in the filtered list. */
  n: number;
  title: string;
  /** Categories this value belongs to, by dimension name (Session, Set, …). */
  groups: Record<string, string>;
  excluded: boolean;
};

export const pValue = (p: number) => (p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(p < 0.01 ? 3 : 2)}`);

const TOGGLE_ITEM = "px-2.5 aria-pressed:bg-foreground aria-pressed:text-background";

export function Panel({ title, children, controls, className }: { title: string; children: ReactNode; controls?: ReactNode; className?: string }) {
  const id = `panel-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="text-base font-extrabold tracking-tight">
          {title}
        </h3>
        {controls}
      </div>
      {children}
    </section>
  );
}

function Figures({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Verdict({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed">{children}</p>;
}

// ---------------------------------------------------------------------------

export function NormalityTest({ values, log, onLogChange, format }: { values: number[]; log: boolean; onLogChange: (v: boolean) => void; format: (ms: number) => string }) {
  const data = useMemo(() => {
    const xs = (log ? values.filter((v) => v > 0).map(Math.log) : values).slice(-5000);
    return { sw: shapiroWilk(xs), skew: skewness(values), kurt: kurtosis(values) };
  }, [values, log]);
  const { sw, skew, kurt } = data;
  const shape = log ? "log-normal" : "normal";

  return (
    <Panel
      title="Is it a normal distribution?"
      controls={
        <ToggleGroup value={[log ? "log" : "normal"]} onValueChange={(v) => v[0] && onLogChange(v[0] === "log")} variant="outline" size="sm" spacing={0} aria-label="Distribution to test">
          <ToggleGroupItem value="normal" className={TOGGLE_ITEM}>
            Normal
          </ToggleGroupItem>
          <ToggleGroupItem value="log" className={TOGGLE_ITEM}>
            Log-normal
          </ToggleGroupItem>
        </ToggleGroup>
      }
    >
      {!sw ? (
        <p className="text-sm text-muted-foreground">Needs at least 3 different times.</p>
      ) : (
        <>
          <Figures
            items={[
              ["Shapiro-Wilk W", sw.w.toFixed(3)],
              ["p-value", pValue(sw.p)],
              ["Skew", Number.isFinite(skew) ? skew.toFixed(2) : "–"],
              ["Excess kurtosis", Number.isFinite(kurt) ? kurt.toFixed(2) : "–"],
              ["Mean", format(mean(values))],
              ["Standard deviation", format(stdev(values))],
            ]}
          />
          <Verdict>
            {sw.p >= 0.05 ? (
              <>
                Your times fit a {shape} distribution well enough ({pValue(sw.p)}). Chances and intervals based on it are reasonable.
              </>
            ) : (
              <>
                Your times are probably not {shape} ({pValue(sw.p)}).
                {skew > 0.5 && !log && " They skew slow, which is typical: a bad solve can run long, a good one can only be so fast. Try log-normal."}
                {kurt > 1 && " There are more extreme times than a bell curve expects; an outlier filter may help."}
              </>
            )}
            {values.length > 5000 && " Tested on your latest 5000."}
          </Verdict>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

export function TrendTest({ samples, format, unit }: { samples: Sample[]; format: (ms: number) => string; unit: string }) {
  const [by, setBy] = useState<"n" | "date">("n");
  const reg = useMemo(() => {
    const kept = samples.filter((s) => !s.excluded && Number.isFinite(s.value));
    const xs = kept.map((s) => (by === "n" ? s.n : s.at / 86400000));
    return linearRegression(
      xs,
      kept.map((s) => s.value),
    );
  }, [samples, by]);

  const per = by === "n" ? 100 : 7;
  const perLabel = by === "n" ? `every 100 ${unit}` : "every week";
  const change = reg ? reg.slope * per : 0;
  const faster = change < 0;

  return (
    <Panel
      title="Are you getting faster?"
      controls={
        <ToggleGroup value={[by]} onValueChange={(v) => v[0] && setBy(v[0] as "n" | "date")} variant="outline" size="sm" spacing={0} aria-label="Measure change against">
          <ToggleGroupItem value="n" className={TOGGLE_ITEM}>
            Per {unit.replace(/s$/, "")}
          </ToggleGroupItem>
          <ToggleGroupItem value="date" className={TOGGLE_ITEM}>
            Per day
          </ToggleGroupItem>
        </ToggleGroup>
      }
    >
      {!reg ? (
        <p className="text-sm text-muted-foreground">Needs at least 3 times{by === "date" ? " on different days" : ""}.</p>
      ) : (
        <>
          <Figures
            items={[
              [`Change ${perLabel}`, `${change > 0 ? "+" : "−"}${format(Math.abs(change))} s`],
              ["p-value", pValue(reg.p)],
              ["R²", reg.r2.toFixed(3)],
            ]}
          />
          <Verdict>
            {reg.p < 0.05 ? (
              <>
                You&apos;re getting {faster ? "faster" : "slower"} by about {format(Math.abs(change))} s {perLabel}, and that&apos;s unlikely to be chance ({pValue(reg.p)}).
              </>
            ) : (
              <>No clear trend yet ({pValue(reg.p)}). Times move around more than they drift.</>
            )}{" "}
            {reg.r2 < 0.05 && reg.p < 0.05 && "The trend is real but small next to solve-to-solve variation. "}
            A straight line is a simplification: improvement usually slows down over time.
          </Verdict>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

type Split = { a: Sample[]; b: Sample[]; aLabel: string; bLabel: string };

export function CompareTest({ samples, dimensions, format, unit }: { samples: Sample[]; dimensions: string[]; format: (ms: number) => string; unit: string }) {
  const [by, setBy] = useState<string>("halves");
  const [recent, setRecent] = useState(50);
  const kept = useMemo(() => samples.filter((s) => !s.excluded && Number.isFinite(s.value)), [samples]);
  const values = useMemo(() => {
    const dim = dimensions.includes(by) ? by : null;
    return dim ? [...new Set(kept.map((s) => s.groups[dim]))].sort() : [];
  }, [by, dimensions, kept]);
  const [aPick, setA] = useState<string | null>(null);
  const [bPick, setB] = useState<string | null>(null);
  const a = aPick && values.includes(aPick) ? aPick : values[0];
  const b = bPick && values.includes(bPick) ? bPick : values[1];

  const split: Split | null = useMemo(() => {
    if (by === "halves") {
      const mid = Math.floor(kept.length / 2);
      return { a: kept.slice(0, mid), b: kept.slice(mid), aLabel: "First half", bLabel: "Second half" };
    }
    if (by === "recent") {
      return { a: kept.slice(-2 * recent, -recent), b: kept.slice(-recent), aLabel: `The ${recent} before`, bLabel: `Last ${recent}` };
    }
    if (!a || !b) return null;
    return { a: kept.filter((s) => s.groups[by] === a), b: kept.filter((s) => s.groups[by] === b), aLabel: a, bLabel: b };
  }, [by, kept, recent, a, b]);

  const result = split ? welchTTest(split.a.map((s) => s.value), split.b.map((s) => s.value)) : null;
  const items = [
    { value: "halves", label: "First half and second half" },
    { value: "recent", label: "Latest and the ones before" },
    ...dimensions.map((d) => ({ value: d, label: `Two of: ${d}` })),
  ];

  return (
    <Panel title="Compare two groups">
      <div className="flex flex-wrap items-center gap-2">
        <Select items={items} value={by} onValueChange={(v) => v && setBy(v)}>
          <SelectTrigger size="sm" aria-label="What to compare">
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
        {by === "recent" && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Latest
            <Input
              type="number"
              min={2}
              max={5000}
              value={recent}
              onChange={(e) => setRecent(Math.max(2, Math.min(5000, Number(e.target.value) || 2)))}
              className="h-7 w-20"
            />
          </label>
        )}
        {dimensions.includes(by) && values.length >= 2 && (
          <>
            <GroupPick value={a} values={values} onChange={setA} label="First group" />
            <span className="text-sm text-muted-foreground">and</span>
            <GroupPick value={b} values={values} onChange={setB} label="Second group" />
          </>
        )}
      </div>
      {dimensions.includes(by) && values.length < 2 ? (
        <p className="text-sm text-muted-foreground">Everything in view is in one group.</p>
      ) : !split || !result ? (
        <p className="text-sm text-muted-foreground">Each group needs at least 2 {unit} with some spread.</p>
      ) : (
        <>
          <Figures
            items={[
              [split.aLabel, `${format(mean(split.a.map((s) => s.value)))} (${split.a.length})`],
              [split.bLabel, `${format(mean(split.b.map((s) => s.value)))} (${split.b.length})`],
              ["Difference", `${format(Math.abs(result.diff))} s`],
              ["Change, 95% interval", `${signed(-result.high, format)} to ${signed(-result.low, format)} s`],
              ["p-value", pValue(result.p)],
              ["Effect size d", Math.abs(result.d).toFixed(2)],
            ]}
          />
          <Verdict>
            {split.bLabel} is {format(Math.abs(result.diff))} s {result.diff > 0 ? "faster" : "slower"} on average than {split.aLabel.toLowerCase()}.{" "}
            {result.p < 0.05 ? `That's unlikely to be chance (${pValue(result.p)}, Welch's t-test)` : `That could easily be chance (${pValue(result.p)}, Welch's t-test)`}
            {`, and the effect is ${effectWord(result.d)}.`}
          </Verdict>
        </>
      )}
    </Panel>
  );
}

const signed = (ms: number, format: (ms: number) => string) => `${ms < 0 ? "−" : "+"}${format(Math.abs(ms))}`;

function effectWord(d: number) {
  const a = Math.abs(d);
  return a < 0.2 ? "negligible" : a < 0.5 ? "small" : a < 0.8 ? "medium" : "large";
}

function GroupPick({ value, values, onChange, label }: { value: string; values: string[]; onChange: (v: string) => void; label: string }) {
  const items = values.map((v) => ({ value: v, label: v }));
  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger size="sm" aria-label={label} className="max-w-44">
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

// ---------------------------------------------------------------------------

/** Small seeded generator so simulated chances don't flicker between renders. */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Chance that one solve, an ao5 and an ao12 come in under a target.
 * Singles use your actual times and two fitted curves; averages are simulated by
 * drawing from your times (a bootstrap), DNFs included.
 */
export function ChancesTest({ pool, format, averages }: { pool: number[]; format: (ms: number) => string; averages: boolean }) {
  const finite = useMemo(() => pool.filter(Number.isFinite), [pool]);
  const med = finite.length ? quantile(finite, 0.5) : 0;
  const [target, setTarget] = useState<string>("");
  const targetMs = target === "" ? Math.round(med / 100) * 100 : Number(target) * 1000;

  const result = useMemo(() => {
    if (finite.length < 5 || !Number.isFinite(targetMs)) return null;
    const m = mean(finite);
    const sd = stdev(finite);
    const logs = finite.filter((v) => v > 0).map(Math.log);
    const lm = mean(logs);
    const ls = stdev(logs);
    const single = pool.filter((v) => v < targetMs).length / pool.length;
    const random = mulberry32(pool.length * 7919 + Math.round(targetMs));
    const sims = 4000;
    const simulate = (n: number) => {
      let hits = 0;
      const draw: number[] = new Array(n);
      for (let k = 0; k < sims; k++) {
        for (let j = 0; j < n; j++) draw[j] = pool[Math.floor(random() * pool.length)];
        const avg = averageOf(draw, n);
        if (avg !== null && avg < targetMs) hits++;
      }
      return hits / sims;
    };
    return {
      single,
      normal: normalCdf(targetMs, m, sd),
      lognormal: targetMs > 0 ? normalCdf(Math.log(targetMs), lm, ls) : 0,
      ao5: averages ? simulate(5) : null,
      ao12: averages ? simulate(12) : null,
    };
  }, [finite, pool, targetMs, averages]);

  const pct = (p: number | null) => (p === null ? "–" : p < 0.001 ? "< 0.1%" : p > 0.999 ? "> 99.9%" : `${(p * 100).toFixed(1)}%`);
  const percentiles = [10, 25, 50, 75, 90];

  return (
    <Panel title="What are your chances?">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Under</span>
        <Input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={target === "" ? (targetMs / 1000).toFixed(1) : target}
          onChange={(e) => setTarget(e.target.value)}
          className="h-8 w-24 font-semibold"
          aria-label="Target time in seconds"
        />
        <span className="text-muted-foreground">seconds</span>
      </label>
      {!result ? (
        <p className="text-sm text-muted-foreground">Needs at least 5 times.</p>
      ) : (
        <Figures
          items={[
            ["One, from your times", pct(result.single)],
            ["One, normal curve", pct(result.normal)],
            ["One, log-normal curve", pct(result.lognormal)],
            ...(averages
              ? ([
                  ["Next ao5, simulated", pct(result.ao5)],
                  ["Next ao12, simulated", pct(result.ao12)],
                ] as [string, ReactNode][])
              : []),
          ]}
        />
      )}
      {finite.length >= 5 && (
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-sm text-muted-foreground">Percentiles: 10% of your times are faster than the first, and so on.</p>
          <dl className="grid grid-cols-5 gap-2 text-sm">
            {percentiles.map((p) => (
              <div key={p}>
                <dt className="text-muted-foreground">{p}%</dt>
                <dd className="font-semibold tabular-nums">{format(quantile(finite, p / 100))}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Panel>
  );
}
