import { splitsOf, type StepName } from "../smartcube/splits";
import { formatMs, formatSolve, type Solve } from "../solves";

/**
 * Where things happen in a solve's video. Times are ms from the start of the
 * clip. The clip knows where the clock stopped; the solve's time and
 * inspection give the rest, and a smart cube solve adds its CFOP steps.
 */

export type SegmentKind = "ready" | "inspection" | StepName | "solve" | "after";

export type Segment = {
  kind: SegmentKind;
  label: string;
  from: number;
  to: number;
  /** For a step: recognition runs from `from` to here, execution from here to `to`. */
  recogTo?: number;
  /** The step was done already when the one before finished. */
  skipped?: boolean;
};

export type Timeline = {
  duration: number;
  inspectStart: number | null;
  clockStart: number;
  stop: number;
  segments: Segment[];
  /** Where each F2L pair but the last was finished. */
  ticks: number[];
};

const STEP_LABEL: Record<StepName, string> = { cross: "Cross", f2l: "F2L", oll: "OLL", pll: "PLL" };
export const INSPECTION_MS = 15000;
const DNF_AFTER_MS = 17000;

/** `stopMs` is null for a clip saved without it: then the clock is taken to stop `tailMs` before the end. */
export function buildTimeline(solve: Solve, stopMs: number | null, duration: number, tailMs = 3000): Timeline {
  const stop = Math.min(duration, stopMs ?? Math.max(0, duration - tailMs));
  const clockStart = Math.max(0, stop - solve.ms);
  const inspectStart = solve.inspectionMs === undefined ? null : Math.max(0, clockStart - solve.inspectionMs);
  const segments: Segment[] = [];
  const ticks: number[] = [];
  const readyEnd = inspectStart ?? clockStart;
  if (readyEnd > 0) segments.push({ kind: "ready", label: "Getting ready", from: 0, to: readyEnd });
  if (inspectStart !== null && clockStart > inspectStart) segments.push({ kind: "inspection", label: "Inspection", from: inspectStart, to: clockStart });

  const splits = solve.moves ? splitsOf(solve) : null;
  let done = 0;
  if (splits) {
    for (const step of splits.steps) {
      if (step.name === "pair") continue;
      const from = clockStart + done;
      const to = Math.min(stop, clockStart + Math.max(done, step.at));
      segments.push({ kind: step.name, label: STEP_LABEL[step.name], from, to, recogTo: Math.max(from, Math.min(to, to - step.execMs)), skipped: step.skipped || undefined });
      done = Math.max(done, step.at);
    }
    const f2l = splits.steps.find((s) => s.name === "f2l");
    for (const pair of splits.pairs) if (!pair.skipped && (!f2l || pair.at < f2l.at)) ticks.push(clockStart + pair.at);
  }
  // Without splits, or past the last step found (a DNF): just "Solve".
  if (clockStart + done < stop - 1) segments.push({ kind: "solve", label: splits ? "Rest of the solve" : "Solve", from: clockStart + done, to: stop });
  if (duration > stop) segments.push({ kind: "after", label: "After", from: stop, to: duration });
  return { duration, inspectStart, clockStart, stop, segments, ticks };
}

export type ClockFace = {
  text: string;
  /** How the face is coloured, as the timer colours its clock. */
  tone: "idle" | "inspect" | "inspect-late" | "inspect-over" | "running" | "done";
  /** What is happening at this moment. */
  phase: string;
  kind: SegmentKind;
};

export function segmentAt(tl: Timeline, t: number): Segment | undefined {
  return tl.segments.find((s) => !s.skipped && t >= s.from && t < s.to) ?? tl.segments.at(-1);
}

/** What the timer showed at `t` in the clip. */
export function clockAt(tl: Timeline, solve: Solve, t: number): ClockFace {
  if (t >= tl.stop) return { text: formatSolve(solve), tone: "done", phase: "Stopped", kind: "after" };
  if (t >= tl.clockStart) {
    const seg = segmentAt(tl, t);
    const kind = seg?.kind ?? "solve";
    const recognizing = seg?.recogTo !== undefined && t < seg.recogTo && kind !== "cross";
    return { text: formatMs(t - tl.clockStart), tone: "running", phase: seg ? (recognizing ? `Recognizing ${seg.label}` : seg.label) : "Solve", kind };
  }
  if (tl.inspectStart !== null && t >= tl.inspectStart) {
    const e = t - tl.inspectStart;
    const text = e > DNF_AFTER_MS ? "DNF" : e > INSPECTION_MS ? "+2" : String(Math.ceil((INSPECTION_MS - e) / 1000));
    return { text, tone: e > INSPECTION_MS ? "inspect-over" : e > 8000 ? "inspect-late" : "inspect", phase: "Inspection", kind: "inspection" };
  }
  return { text: formatMs(0), tone: "idle", phase: "Getting ready", kind: "ready" };
}
