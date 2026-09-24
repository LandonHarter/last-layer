"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCwIcon, Settings2Icon } from "lucide-react";
import { toast } from "sonner";
import { MoveSequence } from "@/components/algs/move-sequence";
import { ScrambleNet } from "@/components/timer/scramble-net";
import { SessionPicker } from "@/components/timer/session-picker";
import { SolveList } from "@/components/timer/solve-list";
import { PenaltyToggle } from "@/components/timer/penalty-toggle";
import { SessionStats } from "@/components/timer/session-stats";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { randomScramble } from "@/lib/scramble";
import {
  addSolve,
  deleteSolve,
  effectiveMs,
  formatMs,
  formatSolve,
  restoreSolve,
  updateTimerSettings,
  useTimerData,
  useTimerSettings,
  type Penalty,
  type Solve,
  type TimerSettings,
} from "@/lib/solves";
import { averageOf } from "@/lib/stats";
import { cn } from "@/lib/utils";

type Phase = "idle" | "inspecting" | "holding" | "ready" | "running";

const INSPECTION_MS = 15000;
// WCA: starting within 2 s after inspection ends costs +2, later is a DNF.
const DNF_AFTER_MS = 17000;

function inspectionPenalty(usedMs: number): Penalty {
  return usedMs > DNF_AFTER_MS ? "dnf" : usedMs > INSPECTION_MS ? "+2" : "none";
}

export function TimerView() {
  const data = useTimerData();
  const settings = useTimerSettings();
  const solves = useMemo(() => data.solves.filter((s) => s.session === data.current), [data]);
  const times = useMemo(() => solves.map(effectiveMs), [solves]);

  const [phase, setPhaseState] = useState<Phase>("idle");
  const [now, setNow] = useState(0);
  const [scramble, setScramble] = useState("");
  const [lastId, setLastId] = useState<string | null>(null);
  const [inspectStart, setInspectStartState] = useState<number | null>(null);

  const phaseRef = useRef<Phase>("idle");
  const startRef = useRef(0);
  const inspectStartRef = useRef<number | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const armInspection = useRef(false);
  // After a stop, the key that stopped the clock is still down; its release must do nothing.
  const swallowRelease = useRef(false);
  const scrambleRef = useRef(scramble);
  const settingsRef = useRef<TimerSettings>(settings);
  scrambleRef.current = scramble;
  settingsRef.current = settings;

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const setInspectStart = useCallback((t: number | null) => {
    inspectStartRef.current = t;
    setInspectStartState(t);
  }, []);

  // Scrambles are random, so make the first one on the client to keep hydration stable.
  useEffect(() => setScramble(randomScramble()), []);

  // Hide the rest of the page while inspecting or solving.
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-timing", phase !== "idle");
    return () => root.removeAttribute("data-timing");
  }, [phase]);

  // Drive the clock face while it's moving.
  const ticking = phase === "running" || inspectStart !== null;
  useEffect(() => {
    if (!ticking) return;
    let frame = requestAnimationFrame(function tick() {
      setNow(performance.now());
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [ticking]);

  const beginHold = useCallback(() => {
    window.clearTimeout(holdTimer.current);
    const hold = settingsRef.current.holdMs;
    if (hold <= 0) return setPhase("ready");
    setPhase("holding");
    holdTimer.current = window.setTimeout(() => {
      if (phaseRef.current === "holding") setPhase("ready");
    }, hold);
  }, [setPhase]);

  const cancel = useCallback(() => {
    window.clearTimeout(holdTimer.current);
    setInspectStart(null);
    armInspection.current = false;
    setPhase("idle");
  }, [setPhase, setInspectStart]);

  const stop = useCallback(() => {
    const end = performance.now();
    const ms = Math.round(end - startRef.current);
    const inspected = inspectStartRef.current;
    const inspectionMs = inspected === null ? undefined : Math.round(startRef.current - inspected);
    setInspectStart(null);
    swallowRelease.current = true;
    setPhase("idle");
    setNow(end);
    const solve = addSolve({
      ms,
      penalty: inspectionMs === undefined ? "none" : inspectionPenalty(inspectionMs),
      scramble: scrambleRef.current,
      at: Date.now(),
      inspectionMs,
    });
    setLastId(solve.id);
    setScramble(randomScramble());
  }, [setPhase, setInspectStart]);

  // Press: start holding (or inspection). Release: start the clock if it's ready.
  const press = useCallback(() => {
    const p = phaseRef.current;
    if (p === "running") return stop();
    if (p === "idle" && settingsRef.current.inspection) {
      armInspection.current = true;
      return;
    }
    if (p === "idle" || p === "inspecting") beginHold();
  }, [beginHold, stop]);

  const release = useCallback(() => {
    if (swallowRelease.current) {
      swallowRelease.current = false;
      return;
    }
    const p = phaseRef.current;
    if (armInspection.current) {
      armInspection.current = false;
      setInspectStart(performance.now());
      setNow(performance.now());
      return setPhase("inspecting");
    }
    if (p === "holding") {
      window.clearTimeout(holdTimer.current);
      return setPhase(inspectStartRef.current === null ? "idle" : "inspecting");
    }
    if (p === "ready") {
      startRef.current = performance.now();
      setNow(startRef.current);
      setPhase("running");
    }
  }, [setPhase, setInspectStart]);

  useEffect(() => {
    const ignore = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      return !!target?.closest("input, textarea, [role=listbox], [role=menu], [data-slot=popover-content]");
    };
    function onKeyDown(e: KeyboardEvent) {
      if (ignore(e)) return;
      if (phaseRef.current === "running") {
        // Any key stops the clock, like slapping a stackmat.
        if (e.repeat || ["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
        e.preventDefault();
        return stop();
      }
      if (e.key === "Escape") return cancel();
      if (e.key !== " ") return;
      e.preventDefault();
      if (!e.repeat) press();
    }
    function onKeyUp(e: KeyboardEvent) {
      if (ignore(e)) return;
      if (e.key === " ") {
        e.preventDefault();
        release();
      } else if (swallowRelease.current) {
        swallowRelease.current = false;
      }
    }
    // A tap anywhere stops a running clock; the timer area handles its own taps first.
    function onPointerDown() {
      if (phaseRef.current !== "running") return;
      stop();
      // This release lands outside the timer area, so nothing will consume it.
      swallowRelease.current = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [cancel, press, release, stop]);

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  const last = solves.find((s) => s.id === lastId) ?? solves.at(-1) ?? null;
  const inspecting = inspectStart !== null && phase !== "running";
  const inspectElapsed = inspecting ? Math.max(0, now - inspectStart) : 0;

  let face: string;
  if (phase === "running") face = settings.showRunning ? formatMs(now - startRef.current, 2) : "Solving";
  else if (inspecting)
    face = inspectElapsed > DNF_AFTER_MS ? "DNF" : inspectElapsed > INSPECTION_MS ? "+2" : String(Math.ceil((INSPECTION_MS - inspectElapsed) / 1000));
  else if (phase === "holding" || phase === "ready") face = formatMs(0);
  else face = last ? formatSolve(last) : formatMs(0);

  const faceColor =
    phase === "holding"
      ? "text-missed"
      : phase === "ready"
        ? "text-learned"
        : inspecting && inspectElapsed > INSPECTION_MS
          ? "text-missed"
          : inspecting && inspectElapsed > 8000
            ? "text-learning"
            : "text-foreground";

  function removeSolve(solve: Solve) {
    deleteSolve(solve.id);
    toast(`Deleted ${formatSolve(solve)}`, { action: { label: "Undo", onClick: () => restoreSolve(solve) } });
  }

  const ao5 = averageOf(times, 5);
  const ao12 = averageOf(times, 12);
  const hideWhileTiming = "transition-opacity duration-200 in-data-timing:pointer-events-none in-data-timing:opacity-0";

  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label="Timer" className="relative flex min-h-[calc(100svh-3.5rem-1px)] flex-col px-4 py-6 sm:px-6 lg:min-h-0">
        <div className={cn("flex flex-col items-center gap-3 text-center", hideWhileTiming)}>
          <h1 className="sr-only">Timer</h1>
          <div className="min-h-[4.5rem] max-w-3xl">
            {scramble && (
              <MoveSequence
                key={scramble}
                alg={scramble}
                className="animate-in justify-center text-[clamp(1.05rem,2.2vw,1.55rem)] leading-snug duration-200 fade-in-0"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <SessionPicker />
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setScramble(randomScramble())}>
              <RefreshCwIcon data-icon="inline-start" />
              New scramble
            </Button>
            <TimerSettingsButton settings={settings} />
          </div>
        </div>

        {/* The whole middle is the touch target, so phones can hold anywhere. */}
        <div
          className="flex flex-1 touch-none select-none flex-col items-center justify-center py-10"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            press();
          }}
          onPointerUp={release}
          onPointerCancel={cancel}
        >
          <output
            aria-live="off"
            aria-label="Time"
            className={cn("font-clock block text-center text-[clamp(5.5rem,19vw,15rem)] leading-none transition-colors duration-100", faceColor)}
          >
            {face}
          </output>
          <p
            className={cn("mt-6 flex gap-8 text-lg tabular-nums text-muted-foreground sm:text-xl", hideWhileTiming)}
            aria-live="polite"
          >
            <span>
              ao5 <span className="font-bold text-foreground">{formatMs(ao5)}</span>
            </span>
            <span>
              ao12 <span className="font-bold text-foreground">{formatMs(ao12)}</span>
            </span>
          </p>
          <div className={cn("mt-4 flex h-8 items-center gap-1", hideWhileTiming)} onPointerDown={(e) => e.stopPropagation()}>
            {last ? (
              <>
                <PenaltyToggle solve={last} />
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-missed" onClick={() => removeSolve(last)}>
                  Delete
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Hold <Kbd>Space</Kbd> until the time turns green, then let go to start. Any key stops it.
              </p>
            )}
          </div>
        </div>

        <ScrambleNet scramble={scramble} className={cn("mx-auto w-44 sm:absolute sm:bottom-6 sm:left-6 sm:w-48", hideWhileTiming)} />
      </section>

      <aside
        aria-label="Session"
        className={cn("flex flex-col gap-5 border-t border-border px-4 py-6 sm:px-6 lg:max-h-[calc(100svh-3.5rem-1px)] lg:border-t-0 lg:border-l", hideWhileTiming)}
      >
        <SessionStats times={times} />
        <SolveList solves={solves} times={times} onDelete={removeSolve} />
      </aside>
    </div>
  );
}

function TimerSettingsButton({ settings }: { settings: TimerSettings }) {
  const row = "flex items-center justify-between gap-4";
  const item = "px-2.5 aria-pressed:bg-foreground aria-pressed:text-background";
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
        <Settings2Icon data-icon="inline-start" />
        Settings
      </PopoverTrigger>
      <PopoverContent className="w-80 gap-4 p-4">
        <div className={row}>
          <span className="text-sm font-medium">Hold to start</span>
          <ToggleGroup
            value={[String(settings.holdMs)]}
            onValueChange={(v) => v[0] && updateTimerSettings({ holdMs: Number(v[0]) })}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Hold to start"
          >
            <ToggleGroupItem value="0" className={item}>Off</ToggleGroupItem>
            <ToggleGroupItem value="300" className={item}>0.3 s</ToggleGroupItem>
            <ToggleGroupItem value="550" className={item}>0.55 s</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className={row}>
          <span className="text-sm font-medium">15 s inspection</span>
          <ToggleGroup
            value={[settings.inspection ? "on" : "off"]}
            onValueChange={(v) => v[0] && updateTimerSettings({ inspection: v[0] === "on" })}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Inspection"
          >
            <ToggleGroupItem value="off" className={item}>Off</ToggleGroupItem>
            <ToggleGroupItem value="on" className={item}>On</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className={row}>
          <span className="text-sm font-medium">Time while solving</span>
          <ToggleGroup
            value={[settings.showRunning ? "show" : "hide"]}
            onValueChange={(v) => v[0] && updateTimerSettings({ showRunning: v[0] === "show" })}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Time while solving"
          >
            <ToggleGroupItem value="show" className={item}>Show</ToggleGroupItem>
            <ToggleGroupItem value="hide" className={item}>Hide</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          With inspection on, tap Space to start the 15 s countdown, then hold to start. Starting after 15 s adds +2, after 17 s is a DNF.
        </p>
      </PopoverContent>
    </Popover>
  );
}
