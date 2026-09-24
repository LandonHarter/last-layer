"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { histogram, mean, niceTicks, normalPdf, normalQuantile, stdev } from "@/lib/stats";
import { cn } from "@/lib/utils";

// Hand-built SVG charts. Colors come from the --chart-* and text tokens so every
// theme works. Marks follow one spec: 2px lines, >=8px dots with a surface ring,
// columns <= 24px with a rounded data end, hairline solid gridlines.

const M = { top: 16, right: 16, bottom: 32, left: 52 };

function useWidth<T extends Element>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

type Scale = ((v: number) => number) & { invert: (p: number) => number };

function linear(d0: number, d1: number, r0: number, r1: number): Scale {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const f = ((v: number) => r0 + (v - d0) * k) as Scale;
  f.invert = (p: number) => (k === 0 ? d0 : d0 + (p - r0) / k);
  return f;
}

function logScale(d0: number, d1: number, r0: number, r1: number): Scale {
  const inner = linear(Math.log(d0), Math.log(d1), r0, r1);
  const f = ((v: number) => inner(Math.log(Math.max(v, 1e-9)))) as Scale;
  f.invert = (p: number) => Math.exp(inner.invert(p));
  return f;
}

const LOG_TICKS = [0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600, 1200].map((s) => s * 1000);

function logTicks(min: number, max: number) {
  const inside = LOG_TICKS.filter((t) => t >= min && t <= max);
  // Keep about six so labels never crowd.
  const step = Math.ceil(inside.length / 6);
  return inside.filter((_, i) => i % step === 0);
}

/** Seconds on an axis: 12 s, 12.5 s, 1:05. */
export function axisSeconds(ms: number): string {
  const s = ms / 1000;
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const r = Math.round(s - m * 60);
    return `${m}:${String(r).padStart(2, "0")}`;
  }
  return String(Number(s.toFixed(1)));
}

const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

// ---------------------------------------------------------------------------
// Shared pieces

function Frame({
  frameRef,
  width,
  height,
  label,
  children,
  tooltip,
  className,
}: {
  frameRef: React.Ref<HTMLDivElement>;
  width: number;
  height: number;
  label: string;
  children: ReactNode;
  tooltip?: { x: number; y: number; content: ReactNode } | null;
  className?: string;
}) {
  return (
    <div ref={frameRef} className={cn("relative w-full", className)} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} className="block overflow-visible text-[11px]">
          {children}
        </svg>
      )}
      {tooltip && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md"
          style={{
            left: Math.min(Math.max(tooltip.x + 14, 0), width - 170),
            top: Math.max(tooltip.y - 20, 0),
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}

function Gridlines({ ticks, y, width, format }: { ticks: number[]; y: Scale; width: number; format: (v: number) => string }) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t} transform={`translate(0 ${y(t)})`}>
          <line x1={M.left} x2={width - M.right} className="stroke-border" strokeWidth={1} />
          <text x={M.left - 8} dy="0.32em" textAnchor="end" className="fill-muted-foreground tabular-nums">
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

function XLabels({ ticks, x, height, format }: { ticks: number[]; x: Scale; height: number; format: (v: number) => string }) {
  return (
    <g>
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={height - M.bottom + 18} textAnchor="middle" className="fill-muted-foreground tabular-nums">
          {format(t)}
        </text>
      ))}
    </g>
  );
}

/** A tooltip row: value first, then the series name with a short line key. */
export function TipRow({ value, label, swatch }: { value: string; label: string; swatch?: string }) {
  return (
    <div className="flex items-center gap-2 tabular-nums">
      {swatch && <span className={cn("h-0.5 w-3 shrink-0 rounded-full", swatch)} />}
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; swatch: string; kind?: "line" | "dot" | "bar"; checked?: boolean; onToggle?: () => void }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {items.map((item) => {
        const key = (
          <span
            className={cn(
              "shrink-0",
              item.swatch,
              item.kind === "dot" ? "size-2.5 rounded-full" : item.kind === "bar" ? "size-2.5 rounded-[2px]" : "h-0.5 w-4 rounded-full",
            )}
          />
        );
        return (
          <li key={item.label}>
            {item.onToggle ? (
              <button
                type="button"
                aria-pressed={item.checked}
                onClick={item.onToggle}
                className={cn("flex items-center gap-1.5 rounded px-1 hover:text-foreground", !item.checked && "opacity-45")}
              >
                {key}
                {item.label}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 px-1">
                {key}
                {item.label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function useKeyboardIndex(count: number) {
  const [index, setIndex] = useState<number | null>(null);
  function onKeyDown(e: React.KeyboardEvent) {
    if (!count) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const d = e.key === "ArrowRight" ? 1 : -1;
      setIndex((i) => Math.min(count - 1, Math.max(0, (i ?? (d > 0 ? -1 : count)) + d)));
    } else if (e.key === "Home") setIndex(0);
    else if (e.key === "End") setIndex(count - 1);
    else if (e.key === "Escape") setIndex(null);
  }
  return { index, setIndex, onKeyDown };
}

// ---------------------------------------------------------------------------
// Values over time

export type TrendPoint = {
  x: number;
  /** ms; Infinity for a DNF, drawn as a tick along the top. */
  y: number;
  /** Filtered out as an outlier: drawn hollow and left out of lines and fits. */
  excluded?: boolean;
  title: string;
};

export type TrendLine = { id: string; label: string; stroke: string; swatch: string; values: (number | null)[] };

function roundedColumn(cx: number, w: number, top: number, base: number) {
  const r = Math.min(4, base - top, w / 2);
  const l = cx - w / 2;
  const rt = cx + w / 2;
  return `M${l},${base}V${top + r}Q${l},${top} ${l + r},${top}H${rt - r}Q${rt},${top} ${rt},${top + r}V${base}Z`;
}

function nearestIndex(n: number, dist: (i: number) => number) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const d = dist(i);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function localPoint(e: React.PointerEvent<SVGElement>) {
  const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
  return { px: e.clientX - box.left, py: e.clientY - box.top };
}

export function TrendChart({
  points,
  lines,
  trend,
  xMode,
  logY = false,
  showPoints = true,
  height = 320,
  yFormat = axisSeconds,
  valueFormat,
  yDomain,
  label,
}: {
  points: TrendPoint[];
  lines: TrendLine[];
  trend?: { slope: number; intercept: number } | null;
  xMode: "index" | "date";
  logY?: boolean;
  showPoints?: boolean;
  height?: number;
  yFormat?: (v: number) => string;
  valueFormat: (v: number) => string;
  yDomain?: [number, number];
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { index, setIndex, onKeyDown } = useKeyboardIndex(points.length);

  const [y0, y1] = useMemo(() => {
    if (yDomain) return yDomain;
    const vals = [
      ...points.filter((p) => showPoints && Number.isFinite(p.y)).map((p) => p.y),
      ...lines.flatMap((l) => l.values.filter((v): v is number => v !== null && Number.isFinite(v))),
    ];
    if (!vals.length) return [1, 2];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = (hi - lo) * 0.06 || hi * 0.1 || 1;
    return logY ? [Math.max(lo / 1.08, 1), hi * 1.08] : [Math.max(0, lo - pad), hi + pad];
  }, [points, lines, logY, showPoints, yDomain]);

  let x0 = Infinity;
  let x1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
  }
  if (!points.length) [x0, x1] = [0, 1];
  if (x1 === x0) x1 = x0 + 1;

  const x = linear(x0, x1, M.left + 6, width - M.right - 6);
  const y = logY ? logScale(y0, y1, height - M.bottom, M.top) : linear(y0, y1, height - M.bottom, M.top);
  const yTicks = logY ? logTicks(y0, y1) : niceTicks(y0, y1, 5);
  const xTicks = niceTicks(x0, x1, Math.max(2, Math.floor(width / (xMode === "date" ? 110 : 80)))).filter(
    (t) => t >= x0 && t <= x1 && (xMode === "date" || Number.isInteger(t)),
  );
  const dotR = points.length > 600 ? 2 : points.length > 150 ? 3 : 4;
  const current = index === null ? null : points[index];

  function path(values: (number | null)[]) {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(points[i].x).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  }

  return (
    <Frame
      frameRef={ref}
      width={width}
      height={height}
      label={label}
      tooltip={
        !current
          ? null
          : {
              x: x(current.x),
              y: Number.isFinite(current.y) && showPoints ? y(current.y) : M.top,
              content: (
                <div className="flex flex-col gap-0.5">
                  <div className="mb-1 text-xs text-muted-foreground">{current.title}</div>
                  {showPoints && (
                    <TipRow
                      value={valueFormat(current.y)}
                      label={current.excluded ? "Outlier, left out" : "This one"}
                      swatch={current.excluded ? undefined : "bg-chart-1"}
                    />
                  )}
                  {lines.map((l) => {
                    const v = l.values[index!];
                    return v == null ? null : <TipRow key={l.id} value={valueFormat(v)} label={l.label} swatch={l.swatch} />;
                  })}
                </div>
              ),
            }
      }
    >
      <g tabIndex={0} onKeyDown={onKeyDown} onBlur={() => setIndex(null)} className="group/chart outline-none" aria-label={`${label}. Use the arrow keys to read values.`}>
        <rect
          x={M.left - 4}
          y={M.top - 4}
          width={Math.max(0, width - M.left - M.right + 8)}
          height={height - M.top - M.bottom + 8}
          rx={6}
          fill="none"
          strokeWidth={2}
          className="stroke-transparent group-focus-visible/chart:stroke-ring"
        />
        <Gridlines ticks={yTicks} y={y} width={width} format={yFormat} />
        <XLabels ticks={xTicks} x={x} height={height} format={xMode === "date" ? (t) => shortDate.format(t) : (t) => String(t)} />
        {current && <line x1={x(current.x)} x2={x(current.x)} y1={M.top} y2={height - M.bottom} className="stroke-muted-foreground/60" strokeWidth={1} />}
        {showPoints &&
          points.map((p, i) =>
            Number.isFinite(p.y) ? (
              <circle
                key={i}
                cx={x(p.x)}
                cy={y(p.y)}
                r={i === index ? dotR + 2 : dotR}
                className={p.excluded ? "fill-card stroke-muted-foreground" : "fill-chart-1 stroke-card"}
                fillOpacity={p.excluded ? 1 : 0.55}
                strokeWidth={p.excluded ? 1.5 : 1}
              />
            ) : (
              <line key={i} x1={x(p.x)} x2={x(p.x)} y1={M.top - 2} y2={M.top + 6} className="stroke-missed" strokeWidth={2} />
            ),
          )}
        {trend && points.length > 1 && (
          <line
            x1={x(x0)}
            x2={x(x1)}
            y1={y(trend.intercept + trend.slope * x0)}
            y2={y(trend.intercept + trend.slope * x1)}
            className="stroke-foreground/50"
            strokeWidth={1.5}
          />
        )}
        {lines.map((l) => (
          <path key={l.id} d={path(l.values)} fill="none" className={l.stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        <rect
          x={M.left}
          y={M.top}
          width={Math.max(0, width - M.left - M.right)}
          height={height - M.top - M.bottom}
          fill="transparent"
          onPointerMove={(e) => {
            const { px } = localPoint(e);
            setIndex(nearestIndex(points.length, (i) => Math.abs(x(points[i].x) - px)));
          }}
          onPointerLeave={() => setIndex(null)}
        />
      </g>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Distribution

export type Fit = "normal" | "lognormal" | "none";

export function HistogramChart({
  values,
  fit,
  bins,
  height = 280,
  valueFormat,
  label,
}: {
  values: number[];
  fit: Fit;
  bins?: number;
  height?: number;
  valueFormat: (v: number) => string;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const hist = useMemo(() => histogram(values, bins), [values, bins]);
  const n = values.length;
  const m = mean(values);
  const sd = stdev(values);
  const logs = useMemo(() => values.filter((v) => v > 0).map(Math.log), [values]);
  const lm = mean(logs);
  const ls = stdev(logs);
  const median = useMemo(() => {
    const s = [...values].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  }, [values]);
  const binW = hist.length ? hist[0].to - hist[0].from : 1;

  const expected = (v: number) => {
    if (fit === "normal" && sd > 0) return n * binW * normalPdf(v, m, sd);
    if (fit === "lognormal" && ls > 0 && v > 0) return (n * binW * normalPdf(Math.log(v), lm, ls)) / v;
    return 0;
  };
  const expectedIn = (from: number, to: number) => {
    // Average of the curve over the bin, close enough for a tooltip.
    let sum = 0;
    for (let k = 0; k < 8; k++) sum += expected(from + ((k + 0.5) / 8) * (to - from));
    return sum / 8;
  };

  const lo = hist[0]?.from ?? 0;
  const hi = hist.at(-1)?.to ?? 1;
  let maxCount = 1;
  for (const b of hist) maxCount = Math.max(maxCount, b.count);
  if (fit !== "none") for (let i = 0; i < 60; i++) maxCount = Math.max(maxCount, expected(lo + ((hi - lo) * i) / 59));

  const x = linear(lo, hi, M.left, width - M.right);
  const y = linear(0, maxCount * 1.08, height - M.bottom, M.top);
  const slot = (x(hi) - x(lo)) / Math.max(1, hist.length);
  const barW = Math.min(24, Math.max(1, slot - 2));
  const curve =
    fit === "none"
      ? ""
      : Array.from({ length: 120 }, (_, i) => {
          const v = lo + ((hi - lo) * i) / 119;
          return `${i ? "L" : "M"}${x(v).toFixed(1)},${y(expected(v)).toFixed(1)}`;
        }).join("");
  // Put the label of the lower marker on its left, the other on its right, so they never overlap.
  const markers = [
    { v: m, label: "Mean", left: m <= median },
    { v: median, label: "Median", left: median < m },
  ];
  const bin = hover === null ? null : hist[hover];

  return (
    <Frame
      frameRef={ref}
      width={width}
      height={height}
      label={label}
      tooltip={
        !bin
          ? null
          : {
              x: x(bin.from) + slot / 2,
              y: y(bin.count),
              content: (
                <div className="flex flex-col gap-0.5">
                  <div className="mb-1 text-xs text-muted-foreground">
                    {valueFormat(bin.from)} to {valueFormat(bin.to)}
                  </div>
                  <TipRow value={String(bin.count)} label={`${((bin.count / n) * 100).toFixed(1)}% of times`} swatch="bg-chart-1" />
                  {fit !== "none" && (
                    <TipRow value={expectedIn(bin.from, bin.to).toFixed(1)} label={`expected if ${fit === "normal" ? "normal" : "log-normal"}`} swatch="bg-chart-2" />
                  )}
                </div>
              ),
            }
      }
    >
      <Gridlines ticks={niceTicks(0, maxCount * 1.08, 4).filter(Number.isInteger)} y={y} width={width} format={(v) => String(v)} />
      <XLabels ticks={niceTicks(lo, hi, Math.max(2, Math.floor(width / 70))).filter((t) => t >= lo && t <= hi)} x={x} height={height} format={axisSeconds} />
      {hist.map((b, i) => (
        <g
          key={i}
          tabIndex={0}
          className="outline-none"
          aria-label={`${valueFormat(b.from)} to ${valueFormat(b.to)}: ${b.count}`}
          onPointerEnter={() => setHover(i)}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(null)}
        >
          <rect x={x(b.from)} y={M.top} width={slot} height={y(0) - M.top} fill="transparent" />
          {b.count > 0 && (
            <path
              d={roundedColumn(x(b.from) + slot / 2, barW, y(b.count), y(0))}
              className={cn("fill-chart-1 transition-opacity", hover !== null && hover !== i && "opacity-60")}
            />
          )}
        </g>
      ))}
      {curve && <path d={curve} fill="none" className="pointer-events-none stroke-chart-2" strokeWidth={2} strokeLinejoin="round" />}
      {n > 1 &&
        markers.map((mk) => (
          <g key={mk.label} className="pointer-events-none">
            <line x1={x(mk.v)} x2={x(mk.v)} y1={M.top + 10} y2={y(0)} className="stroke-foreground/60" strokeWidth={1} />
            <text x={x(mk.v) + (mk.left ? -4 : 4)} y={M.top + 4} textAnchor={mk.left ? "end" : "start"} className="fill-muted-foreground">
              {mk.label}
            </text>
          </g>
        ))}
    </Frame>
  );
}

/** Normal Q-Q plot: straight line means normal. With log, checks log-normal instead. */
export function QQChart({
  values,
  log = false,
  height = 280,
  valueFormat,
  label,
}: {
  values: number[];
  log?: boolean;
  height?: number;
  valueFormat: (v: number) => string;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const pts = useMemo(() => {
    const s = values.filter((v) => !log || v > 0).sort((a, b) => a - b);
    const n = s.length;
    return s.map((v, i) => ({ z: normalQuantile((i + 1 - 0.375) / (n + 0.25)), v, t: log ? Math.log(v) : v }));
  }, [values, log]);
  const { index, setIndex, onKeyDown } = useKeyboardIndex(pts.length);
  if (pts.length < 3) return <p className="text-sm text-muted-foreground">Needs at least 3 times.</p>;

  const ts = pts.map((p) => p.t);
  const m = mean(ts);
  const sd = stdev(ts);
  const z0 = pts[0].z;
  const z1 = pts.at(-1)!.z;
  const t0 = Math.min(ts[0], m + sd * z0);
  const t1 = Math.max(ts.at(-1)!, m + sd * z1);
  const pad = (t1 - t0) * 0.05 || 1;
  const toMs = (t: number) => (log ? Math.exp(t) : t);
  const x = linear(z0 - 0.1, z1 + 0.1, M.left + 6, width - M.right);
  const y = linear(t0 - pad, t1 + pad, height - M.bottom, M.top);
  const yTicks = log ? logTicks(Math.exp(t0 - pad), Math.exp(t1 + pad)).map(Math.log) : niceTicks(t0 - pad, t1 + pad, 5);
  const r = pts.length > 400 ? 2.5 : 4;
  const current = index === null ? null : pts[index];

  return (
    <Frame
      frameRef={ref}
      width={width}
      height={height}
      label={label}
      tooltip={
        !current
          ? null
          : {
              x: x(current.z),
              y: y(current.t),
              content: (
                <div className="flex flex-col gap-0.5">
                  <div className="mb-1 text-xs text-muted-foreground">
                    {ordinal(index! + 1)} fastest of {pts.length}
                  </div>
                  <TipRow value={valueFormat(current.v)} label="Your time" swatch="bg-chart-1" />
                  <TipRow value={valueFormat(toMs(m + sd * current.z))} label={log ? "If log-normal" : "If normal"} swatch="bg-foreground/50" />
                </div>
              ),
            }
      }
    >
      <g tabIndex={0} onKeyDown={onKeyDown} onBlur={() => setIndex(null)} className="group/chart outline-none" aria-label={`${label}. Use the arrow keys to read values.`}>
        <rect
          x={M.left - 4}
          y={M.top - 4}
          width={Math.max(0, width - M.left - M.right + 8)}
          height={height - M.top - M.bottom + 8}
          rx={6}
          fill="none"
          strokeWidth={2}
          className="stroke-transparent group-focus-visible/chart:stroke-ring"
        />
        <Gridlines ticks={yTicks} y={y} width={width} format={(t) => axisSeconds(toMs(t))} />
        <XLabels
          ticks={[-3, -2, -1, 0, 1, 2, 3].filter((z) => z >= z0 - 0.1 && z <= z1 + 0.1)}
          x={x}
          height={height}
          format={(z) => (z === 0 ? "0" : `${z > 0 ? "+" : "−"}${Math.abs(z)}σ`)}
        />
        <line x1={x(z0)} x2={x(z1)} y1={y(m + sd * z0)} y2={y(m + sd * z1)} className="stroke-foreground/50" strokeWidth={1.5} />
        {pts.map((p, i) => (
          <circle key={i} cx={x(p.z)} cy={y(p.t)} r={i === index ? r + 2 : r} className="fill-chart-1 stroke-card" fillOpacity={0.7} strokeWidth={1} />
        ))}
        <rect
          x={M.left}
          y={M.top}
          width={Math.max(0, width - M.left - M.right)}
          height={height - M.top - M.bottom}
          fill="transparent"
          onPointerMove={(e) => {
            const { px, py } = localPoint(e);
            setIndex(nearestIndex(pts.length, (i) => (x(pts[i].z) - px) ** 2 + (y(pts[i].t) - py) ** 2));
          }}
          onPointerLeave={() => setIndex(null)}
        />
      </g>
    </Frame>
  );
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// ---------------------------------------------------------------------------
// Groups

export type GroupBar = { label: string; value: number; low?: number; high?: number; count: number };

/** Columns with an optional interval whisker, for a mean (or rate) per group. */
export function GroupBarChart({
  groups,
  height = 240,
  valueFormat,
  yFormat = axisSeconds,
  yMax,
  label,
  countLabel = "solves",
}: {
  groups: GroupBar[];
  height?: number;
  valueFormat: (v: number) => string;
  yFormat?: (v: number) => string;
  yMax?: number;
  label: string;
  countLabel?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const top = (yMax ?? Math.max(1, ...groups.map((g) => (g.high !== undefined && Number.isFinite(g.high) ? g.high : g.value)))) * 1.08;
  const y = linear(0, top, height - M.bottom, M.top);
  const slot = (width - M.left - M.right) / Math.max(1, groups.length);
  const barW = Math.max(2, Math.min(24, slot - 6));
  const every = Math.max(1, Math.ceil((groups.length * 44) / Math.max(1, width - M.left - M.right)));
  const clampY = (v: number) => y(Math.min(top, Math.max(0, v)));
  const g = hover === null ? null : groups[hover];

  return (
    <Frame
      frameRef={ref}
      width={width}
      height={height}
      label={label}
      tooltip={
        !g
          ? null
          : {
              x: M.left + slot * hover! + slot / 2,
              y: y(g.value),
              content: (
                <div className="flex flex-col gap-0.5">
                  <div className="mb-1 text-xs text-muted-foreground">{g.label}</div>
                  <TipRow value={valueFormat(g.value)} label={`${g.count} ${countLabel}`} swatch="bg-chart-1" />
                  {g.low !== undefined && Number.isFinite(g.low) && g.high !== undefined && (
                    <div className="text-xs text-muted-foreground">
                      95% interval {valueFormat(g.low)} to {valueFormat(g.high)}
                    </div>
                  )}
                </div>
              ),
            }
      }
    >
      <Gridlines ticks={niceTicks(0, top, 4)} y={y} width={width} format={yFormat} />
      {groups.map((grp, i) => {
        const cx = M.left + slot * i + slot / 2;
        return (
          <g
            key={grp.label}
            tabIndex={0}
            className="outline-none"
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${grp.label}: ${valueFormat(grp.value)}, ${grp.count} ${countLabel}`}
          >
            <rect x={cx - slot / 2} y={M.top} width={slot} height={y(0) - M.top} fill="transparent" />
            {grp.value > 0 && (
              <path d={roundedColumn(cx, barW, y(grp.value), y(0))} className={cn("fill-chart-1 transition-opacity", hover !== null && hover !== i && "opacity-60")} />
            )}
            {grp.low !== undefined && grp.high !== undefined && Number.isFinite(grp.low) && Number.isFinite(grp.high) && (
              <g className="stroke-foreground/70" strokeWidth={1.5}>
                <line x1={cx} x2={cx} y1={clampY(grp.low)} y2={clampY(grp.high)} />
                <line x1={cx - 4} x2={cx + 4} y1={clampY(grp.high)} y2={clampY(grp.high)} />
                <line x1={cx - 4} x2={cx + 4} y1={clampY(grp.low)} y2={clampY(grp.low)} />
              </g>
            )}
            {i % every === 0 && (
              <text x={cx} y={height - M.bottom + 18} textAnchor="middle" className="fill-muted-foreground">
                {grp.label}
              </text>
            )}
          </g>
        );
      })}
    </Frame>
  );
}
