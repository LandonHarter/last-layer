"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCwIcon, Settings2Icon } from "lucide-react";
import { toast } from "sonner";
import { MoveSequence } from "@/components/algs/move-sequence";
import { ScrambleNet } from "@/components/timer/scramble-net";
import { SessionPicker } from "@/components/timer/session-picker";
import { SolveList } from "@/components/timer/solve-list";
import { CasePicker } from "@/components/timer/case-picker";
import { PenaltyToggle } from "@/components/timer/penalty-toggle";
import { SessionStats } from "@/components/timer/session-stats";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cubeSize, scrambleFor, type TimerPuzzle } from "@/lib/scramble";
import type { StackmatPacket } from "@/lib/stackmat";
import { useAudioInputs, useStackmat, type StackmatConnection } from "@/lib/use-stackmat";
import {
  addSolve,
  deleteSolve,
  effectiveMs,
  formatMs,
  formatSolve,
  restoreSolve,
  sessionPuzzle,
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

const CONNECTION: Record<StackmatConnection, string> = {
  starting: "Connecting to the Stackmat…",
  "no-signal": "No Stackmat signal. Turn it on and plug it into the audio input picked in Settings.",
  connected: "Stackmat connected",
  blocked: "Allow the microphone so the page can read the Stackmat.",
  error: "Couldn't open that audio input. Pick another in Settings.",
};

export function TimerView() {
  const data = useTimerData();
  const settings = useTimerSettings();
  const solves = useMemo(() => data.solves.filter((s) => s.session === data.current), [data]);
  const puzzle = sessionPuzzle(data.sessions.find((s) => s.id === data.current));
  const times = useMemo(() => solves.map(effectiveMs), [solves]);

  const [phase, setPhaseState] = useState<Phase>("idle");
  const [now, setNow] = useState(0);
  // Kept with the puzzle it was made for: after a session switch, the old one must not be drawn as the new puzzle.
  const [scrambled, setScrambled] = useState({ puzzle, text: "" });
  const scramble = scrambled.puzzle === puzzle ? scrambled.text : "";
  const newScramble = useCallback((p: TimerPuzzle) => setScrambled({ puzzle: p, text: scrambleFor(p) }), []);
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
  const puzzleRef = useRef<TimerPuzzle>(puzzle);
  scrambleRef.current = scramble;
  settingsRef.current = settings;
  puzzleRef.current = puzzle;

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const setInspectStart = useCallback((t: number | null) => {
    inspectStartRef.current = t;
    setInspectStartState(t);
  }, []);

  // Scrambles are random, so make the first one on the client to keep hydration stable.
  // A session on another puzzle needs a scramble for that puzzle.
  useEffect(() => newScramble(puzzle), [puzzle, newScramble]);

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

  /** Stop the clock. A Stackmat passes its own time, which is the one that counts. */
  const stop = useCallback((stackmatMs?: number) => {
    const end = performance.now();
    const ms = stackmatMs ?? Math.round(end - startRef.current);
    const inspected = inspectStartRef.current;
    const inspectionMs = inspected === null ? undefined : Math.round(startRef.current - inspected);
    setInspectStart(null);
    // The mat stops itself, so no key is down to swallow.
    swallowRelease.current = stackmatMs === undefined;
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
    newScramble(puzzleRef.current);
  }, [setPhase, setInspectStart, newScramble]);

  // Press: start holding (or inspection). Release: start the clock if it's ready.
  const press = useCallback(() => {
    const p = phaseRef.current;
    const stackmat = settingsRef.current.input === "stackmat";
    if (p === "running") return stackmat ? undefined : stop();
    if (p === "idle" && settingsRef.current.inspection) {
      armInspection.current = true;
      return;
    }
    // With a Stackmat, the mat starts the clock; Space only starts inspection.
    if (!stackmat && (p === "idle" || p === "inspecting")) beginHold();
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
    if (settingsRef.current.input === "stackmat") return;
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
        if (settingsRef.current.input === "stackmat") return;
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
      if (phaseRef.current !== "running" || settingsRef.current.input === "stackmat") return;
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

  // The Stackmat drives the phases itself: hands down, green, running, stopped.
  const lastPacket = useRef<StackmatPacket | null>(null);
  const onPacket = useCallback(
    (packet: StackmatPacket, at: number) => {
      const prev = lastPacket.current;
      lastPacket.current = packet;
      const p = phaseRef.current;
      const running = packet.ms > 0 && (packet.status === " " || (prev !== null && packet.ms > prev.ms && packet.status !== "S"));
      if (running) {
        // Follow the mat's time, and let the clock face run smoothly between packets.
        startRef.current = at - packet.ms;
        if (p !== "running") {
          window.clearTimeout(holdTimer.current);
          armInspection.current = false;
          setNow(at);
          setPhase("running");
        }
        return;
      }
      if (p === "running") {
        // Reset mid-solve throws the solve away; anything else stopped it.
        return packet.status === "I" ? cancel() : stop(packet.ms);
      }
      const hands = packet.status === "A" ? "ready" : packet.status === "L" || packet.status === "R" || packet.status === "C" ? "holding" : null;
      if (hands && packet.status !== prev?.status) setPhase(hands);
      else if (!hands && (p === "holding" || p === "ready")) setPhase(inspectStartRef.current === null ? "idle" : "inspecting");
    },
    [cancel, setPhase, stop],
  );
  const stackmat = settings.input === "stackmat";
  const connection = useStackmat(stackmat, settings.stackmatDevice || undefined, onPacket);

  // Leaving Stackmat mode mid-solve leaves nothing running.
  useEffect(() => {
    if (!stackmat) lastPacket.current = null;
    if (!stackmat && phaseRef.current !== "idle") cancel();
  }, [stackmat, cancel]);

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

  // Big-cube and megaminx scrambles run long, so they get smaller type and scroll if they must.
  const long = (cubeSize(puzzle) ?? 5) >= 5;
  const scrambleSize = long
    ? "max-h-[28svh] overflow-y-auto text-sm sm:text-base"
    : puzzle === "4x4"
      ? "text-[clamp(0.95rem,1.7vw,1.2rem)]"
      : "text-[clamp(1.05rem,2.2vw,1.55rem)]";

  return (
    // On desktop the timer column sits between two equal side columns, so the clock is centred on the screen.
    <div className="mx-auto grid w-full max-w-7xl flex-1 lg:grid-cols-[18rem_minmax(0,1fr)_18rem] xl:grid-cols-[22rem_minmax(0,1fr)_22rem]">
      <section aria-label="Timer" className="relative flex min-h-[calc(100svh-3.5rem-1px)] flex-col px-4 py-6 sm:px-6 lg:col-start-2 lg:px-2">
        {/* The whole timer area is the touch target, so phones can hold anywhere. It reaches up under the
            header so the clock in it is centred on the screen once the header fades out. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 -top-[calc(3.5rem+1px)] bottom-0 touch-none select-none"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            press();
          }}
          onPointerUp={release}
          onPointerCancel={cancel}
        />

        <div className={cn("relative z-10 flex flex-col items-center gap-3 text-center", hideWhileTiming)}>
          <h1 className="sr-only">Timer</h1>
          <div className="min-h-[4.5rem] max-w-3xl">
            {scramble && (
              <MoveSequence key={scramble} alg={scramble} className={cn("animate-in justify-center leading-snug duration-200 fade-in-0", scrambleSize)} />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <SessionPicker />
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => newScramble(puzzle)}>
              <RefreshCwIcon data-icon="inline-start" />
              New scramble
            </Button>
            <TimerSettingsButton settings={settings} />
          </div>
        </div>

        {/* The clock alone decides the centre; everything else hangs below it. */}
        <div className="pointer-events-none absolute inset-x-0 -top-[calc(3.5rem+1px)] bottom-0 flex items-center justify-center">
          <div className="relative">
            <output
              aria-live="off"
              aria-label="Time"
              className={cn(
                "font-clock block text-center text-[clamp(5.5rem,19vw,15rem)] leading-none whitespace-nowrap transition-colors duration-100 lg:text-[clamp(6rem,11vw,12rem)]",
                faceColor,
              )}
            >
              {face}
            </output>
            <div className={cn("absolute top-full left-1/2 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center", hideWhileTiming)}>
              <p className="mt-6 flex gap-8 text-lg tabular-nums text-muted-foreground sm:text-xl" aria-live="polite">
                <span>
                  ao5 <span className="font-bold text-foreground">{formatMs(ao5)}</span>
                </span>
                <span>
                  ao12 <span className="font-bold text-foreground">{formatMs(ao12)}</span>
                </span>
              </p>
              <div className="pointer-events-auto mt-4 flex min-h-8 items-center gap-1 text-center" onPointerDown={(e) => e.stopPropagation()}>
                {last ? (
                  <>
                    <PenaltyToggle solve={last} />
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-missed" onClick={() => removeSolve(last)}>
                      Delete
                    </Button>
                  </>
                ) : stackmat ? (
                  <p className="text-sm text-muted-foreground">Put both hands on the mat until it turns green, then lift them to start.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Hold <Kbd>Space</Kbd> until the time turns green, then let go to start. Any key stops it.
                  </p>
                )}
              </div>
              {stackmat && (
                <p
                  className={cn(
                    "mt-1 flex items-center gap-2 text-sm",
                    connection === "connected" || connection === "starting" ? "text-muted-foreground" : "text-missed",
                  )}
                  aria-live="polite"
                >
                  <span aria-hidden="true" className={cn("size-2 rounded-full", connection === "connected" ? "bg-learned" : "bg-missed")} />
                  {CONNECTION[connection]}
                </p>
              )}
              {last && puzzle === "3x3" && (
                <div className="pointer-events-auto mt-1 flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                  <CasePicker solve={last} step="oll" />
                  <CasePicker solve={last} step="pll" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom-left of the timer on small screens; on desktop, in the empty left column. */}
        <ScrambleNet
          scramble={scramble}
          puzzle={puzzle}
          className={cn(
            "pointer-events-none absolute bottom-4 left-4 w-28 sm:bottom-6 sm:left-6 sm:w-48 lg:right-[calc(100%+1.5rem)] lg:left-auto lg:w-56",
            hideWhileTiming,
          )}
        />
      </section>

      <aside
        aria-label="Session"
        className={cn("flex flex-col gap-5 border-t border-border px-4 py-6 sm:px-6 lg:col-start-3 lg:max-h-[calc(100svh-3.5rem-1px)] lg:border-t-0 lg:border-l", hideWhileTiming)}
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
  const [open, setOpen] = useState(false);
  // Device names only show once the microphone is allowed, so look again on each open.
  const inputs = useAudioInputs(open && settings.input);
  const devices = [{ value: "", label: "Default input" }, ...inputs.map((d) => ({ value: d.id, label: d.label }))];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
        <Settings2Icon data-icon="inline-start" />
        Settings
      </PopoverTrigger>
      <PopoverContent className="w-80 gap-4 p-4">
        <div className={row}>
          <span className="text-sm font-medium">Timer</span>
          <ToggleGroup
            value={[settings.input]}
            onValueChange={(v) => v[0] && updateTimerSettings({ input: v[0] as TimerSettings["input"] })}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Timer"
          >
            <ToggleGroupItem value="keyboard" className={item}>Keyboard</ToggleGroupItem>
            <ToggleGroupItem value="stackmat" className={item}>Stackmat</ToggleGroupItem>
          </ToggleGroup>
        </div>
        {settings.input === "stackmat" && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Stackmat input</span>
            <Select items={devices} value={settings.stackmatDevice} onValueChange={(v) => updateTimerSettings({ stackmatDevice: (v as string | null) ?? "" })}>
              <SelectTrigger className="h-9 w-full" aria-label="Stackmat input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Plug the timer&apos;s data port into a microphone or line-in jack (or a USB sound card). It reads the signal as audio.
            </p>
          </div>
        )}
        {settings.input === "keyboard" && (
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
        )}
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
          With inspection on, tap Space to start the 15 s countdown, then {settings.input === "stackmat" ? "start the mat" : "hold to start"}. Starting
          after 15 s adds +2, after 17 s is a DNF.
        </p>
      </PopoverContent>
    </Popover>
  );
}
