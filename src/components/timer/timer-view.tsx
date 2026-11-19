"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCwIcon, Settings2Icon } from "lucide-react";
import { toast } from "sonner";
import { MoveSequence } from "@/components/algs/move-sequence";
import { ScrambleNet } from "@/components/timer/scramble-net";
import { SessionPicker } from "@/components/timer/session-picker";
import { SolveList } from "@/components/timer/solve-list";
import { SolveReplay } from "@/components/timer/solve-replay";
import { CasePicker } from "@/components/timer/case-picker";
import { PenaltyToggle } from "@/components/timer/penalty-toggle";
import { AddTimeButton, TypedClock, type TypedTime } from "@/components/timer/add-time";
import { SessionStats } from "@/components/timer/session-stats";
import { DailyCard } from "@/components/timer/daily-card";
import { ClipDialog } from "@/components/timer/clip-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { dailyRuns, todayRun } from "@/lib/daily";
import { cubeSize, scrambleFor, type TimerPuzzle } from "@/lib/scramble";
import { useSolver } from "@/lib/use-solver";
import type { StackmatPacket } from "@/lib/stackmat";
import { useAudioInputs, useStackmat, type StackmatConnection } from "@/lib/use-stackmat";
import {
  addSolve,
  deleteSolve,
  effectiveMs,
  formatMs,
  formatSolve,
  getTimerData,
  restoreSolve,
  sessionPuzzle,
  updateTimerSettings,
  useTimerData,
  useTimerSettings,
  type Penalty,
  type Solve,
  type TimerSettings,
  type VideoSaveRule,
} from "@/lib/solves";
import { averageOf } from "@/lib/stats";
import { isSolved } from "@/lib/cube";
import { ScrambleGuide, type GuideStatus } from "@/lib/smartcube/guide";
import { encodeMoves, fitTimes, mergeQuarterTurns } from "@/lib/smartcube/moves";
import { identifyCases } from "@/lib/smartcube/splits";
import { cubeState, markSolved, onCubeTurn, useSmartCube, VIRTUAL_CUBE, type CubeTurn } from "@/lib/smartcube/store";
import { signedIn } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { autoSave } from "@/lib/video/rules";
import {
  cameraStream,
  cancelRecording,
  forgetSolve,
  recordingSupported,
  startRecording,
  stopRecording,
  useCamera,
  useRecorder,
  useVideoInputs,
} from "@/lib/video/recorder";

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
  const runs = useMemo(() => dailyRuns(data.solves, data.current), [data]);
  // "Start daily" waits for the next solve; it belongs to the session it was pressed in.
  const [armed, setArmed] = useState<{ session: string; size: number } | null>(null);
  const armedSize = armed?.session === data.current ? armed.size : null;
  const armedRef = useRef(armedSize);
  armedRef.current = armedSize;

  const cube = useSmartCube();
  const cubeInput = settings.input === "cube";
  const cubeReady = puzzle === "3x3" && cube.status === "connected";
  // A smart cube runs the timer on 3x3 sessions once it's connected.
  const cubeLive = cubeInput && cubeReady;
  // With the keyboard or a Stackmat running the clock, a connected cube still follows the scramble and records the solve.
  const cubeTrack = cubeReady && settings.input !== "typing";
  const cubeMoves = useRef<CubeTurn[]>([]);
  // Keyboard or Stackmat with a cube: waiting for the scramble to finish, recording turns, or solved.
  const track = useRef<"waiting" | "solving" | "done">("waiting");
  const guideRef = useRef<ScrambleGuide | null>(null);
  const [guide, setGuide] = useState<GuideStatus | null>(null);

  const [phase, setPhaseState] = useState<Phase>("idle");
  const [now, setNow] = useState(0);
  // Kept with the puzzle it was made for: after a session switch, the old one must not be drawn as the new puzzle.
  const [scrambled, setScrambled] = useState({ puzzle, text: "" });
  const scramble = scrambled.puzzle === puzzle ? scrambled.text : "";
  const { sq1Scramble } = useSolver();
  // Square-1 scrambles are random-state, made in the worker; the next one is made while this one is solved.
  const nextSq1 = useRef<Promise<string> | null>(null);
  const scrambleSeq = useRef(0);
  const newScramble = useCallback(
    (p: TimerPuzzle) => {
      const seq = ++scrambleSeq.current;
      if (p !== "sq1") return setScrambled({ puzzle: p, text: scrambleFor(p) });
      setScrambled({ puzzle: p, text: "" });
      const pending = nextSq1.current ?? sq1Scramble();
      nextSq1.current = sq1Scramble();
      nextSq1.current.catch(() => {});
      pending
        // A worker that stopped (a remount) takes its requests with it: ask the new one, then make it here.
        .catch(() => {
          nextSq1.current = null;
          return sq1Scramble().catch(() => scrambleFor(p));
        })
        .then((text) => {
          if (scrambleSeq.current === seq) setScrambled({ puzzle: p, text });
        });
    },
    [sq1Scramble],
  );
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

  /** The daily size to tag the solve being saved with: today's run until it's full, or a freshly started one. */
  const dailyTag = useCallback((): number | undefined => {
    const d = getTimerData();
    const run = todayRun(dailyRuns(d.solves, d.current));
    if (run) return run.done ? undefined : run.size;
    if (armedRef.current === null) return undefined;
    setArmed(null);
    return armedRef.current;
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
    // A cube that isn't running the clock forgets the thrown-away attempt and looks at the scramble again.
    const g = guideRef.current;
    if (g && settingsRef.current.input !== "cube") {
      const next = new ScrambleGuide(g.scramble, cubeState());
      guideRef.current = next;
      setGuide(next.current);
      cubeMoves.current = [];
      track.current = "waiting";
    }
  }, [setPhase, setInspectStart]);

  /**
   * Stop the clock. A Stackmat passes its own time, which is the one that counts.
   * A smart cube solve keeps its turns, and its OLL and PLL are tagged from them, whatever ran the clock.
   */
  const stop = useCallback((stackmatMs?: number, byCube = false) => {
    const end = performance.now();
    let ms = stackmatMs ?? Math.round(end - startRef.current);
    const inspected = inspectStartRef.current;
    const inspectionMs = inspected === null ? undefined : Math.round(startRef.current - inspected);
    const extra: Partial<Solve> = {};
    const raw = cubeMoves.current;
    cubeMoves.current = [];
    track.current = "waiting";
    if (raw.length) {
      const fitted = fitTimes(raw);
      const timed = mergeQuarterTurns(raw.map((m, i) => ({ move: m.move, t: fitted[i] - fitted[0] })));
      // Solved on the cube: the time is first turn to last, on the cube's clock.
      if (byCube) ms = Math.round(timed.at(-1)!.t);
      extra.moves = encodeMoves(timed);
      try {
        Object.assign(extra, identifyCases(scrambleRef.current, timed));
      } catch {
        // Not a CFOP solve we can read: no tags.
      }
    }
    setInspectStart(null);
    // The mat and the cube stop themselves, so no key is down to swallow.
    swallowRelease.current = stackmatMs === undefined && !byCube;
    setPhase("idle");
    setNow(end);
    const solve = addSolve({
      ms,
      penalty: inspectionMs === undefined ? "none" : inspectionPenalty(inspectionMs),
      scramble: scrambleRef.current,
      at: Date.now(),
      inspectionMs,
      daily: dailyTag(),
      ...extra,
    });
    const set = settingsRef.current;
    if (set.videoOn) {
      const session = getTimerData().solves.filter((s) => s.session === solve.session);
      stopRecording(solve.id, set.videoTailMs, signedIn() && autoSave(set, solve, session));
    }
    setLastId(solve.id);
    newScramble(puzzleRef.current);
  }, [setPhase, setInspectStart, newScramble, dailyTag]);

  /** Save a time typed in by hand, against the scramble on screen. */
  const addTyped = useCallback(
    (t: TypedTime) => {
      const solve = addSolve({ ...t, scramble: scrambleRef.current, at: Date.now(), daily: dailyTag() });
      setLastId(solve.id);
      newScramble(puzzleRef.current);
      toast(`Added ${formatSolve(solve)}`, { action: { label: "Undo", onClick: () => deleteSolve(solve.id) } });
    },
    [newScramble, dailyTag],
  );

  // Press: start holding (or inspection). Release: start the clock if it's ready.
  const press = useCallback(() => {
    if (settingsRef.current.input === "typing") return;
    const p = phaseRef.current;
    // The cube starts itself; a key or tap only stops it, in case the cube lost track.
    if (settingsRef.current.input === "cube") return p === "running" ? stop() : undefined;
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
    if (settingsRef.current.input === "typing" || settingsRef.current.input === "cube") {
      swallowRelease.current = false;
      return;
    }
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
      return !!target?.closest("input, textarea, [role=listbox], [role=menu], [role=dialog], [data-slot=popover-content]");
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
  // The smart cube: follow the scramble, start inspection (or get ready) once scrambled,
  // start on the first turn, stop when solved.
  useEffect(() => {
    cubeMoves.current = [];
    track.current = "waiting";
    if (!cubeTrack || !scramble) {
      guideRef.current = null;
      setGuide(null);
      return;
    }
    const g = new ScrambleGuide(scramble, cubeState());
    guideRef.current = g;
    setGuide(g.current);
  }, [cubeTrack, cubeLive, scramble]);

  // Lost (the cube wasn't solved): look again whenever the cube changes, so solving it or Mark solved picks the scramble up.
  useEffect(() => {
    const g = guideRef.current;
    if (!g || phaseRef.current !== "idle" || g.current.kind !== "lost") return;
    const next = new ScrambleGuide(g.scramble, cubeState());
    if (next.current.kind === "lost") return;
    guideRef.current = next;
    setGuide(next.current);
  }, [cube.facelets]);

  useEffect(() => {
    if (!cubeTrack) return;
    return onCubeTurn((t) => {
      const p = phaseRef.current;
      if (!cubeLive) {
        // The keyboard or Stackmat runs the clock. Every turn after the scramble is part of the solve
        // (the mat may not have reported running yet), until the cube is solved.
        if (track.current === "done") return;
        const g = guideRef.current;
        if (track.current === "waiting") {
          if (!g) return;
          if (g.current.kind !== "scrambled") return setGuide(g.turn(t.move, t.state));
          track.current = "solving";
          cubeMoves.current = [];
        }
        cubeMoves.current.push(t);
        if (isSolved(t.state)) track.current = "done";
        return;
      }
      if (p === "running") {
        cubeMoves.current.push(t);
        if (isSolved(t.state)) stop(undefined, true);
        return;
      }
      if (p === "inspecting" || p === "ready") {
        cubeMoves.current = [t];
        startRef.current = t.local;
        setNow(performance.now());
        setPhase("running");
        return;
      }
      const g = guideRef.current;
      if (!g) return;
      const status = g.turn(t.move, t.state);
      setGuide(status);
      if (status.kind !== "scrambled") return;
      if (settingsRef.current.inspection) {
        setInspectStart(performance.now());
        setNow(performance.now());
        setPhase("inspecting");
      } else {
        setPhase("ready");
      }
    });
  }, [cubeTrack, cubeLive, setPhase, setInspectStart, stop]);

  // Filming: the camera stays open on the Timer; a recording runs from inspection (or the hold) until a
  // little after the clock stops. Back to idle without a solve (a cancel, an early release) throws it away.
  const filming = settings.videoOn && settings.input !== "typing";
  useCamera(filming, settings.videoDevice);
  useEffect(() => {
    if (!filming) return;
    if (phase === "idle") cancelRecording();
    else startRecording();
  }, [phase, filming]);
  const recorder = useRecorder();

  const stackmat = settings.input === "stackmat";
  const typing = settings.input === "typing";
  const connection = useStackmat(stackmat, settings.stackmatDevice || undefined, onPacket);

  // Leaving Stackmat mode mid-solve leaves nothing running, and typing never runs the clock.
  useEffect(() => {
    if (!stackmat) lastPacket.current = null;
    if (!stackmat && phaseRef.current !== "idle") cancel();
  }, [settings.input, stackmat, cancel]);

  const last = solves.find((s) => s.id === lastId) ?? solves.at(-1) ?? null;
  const [replaying, setReplaying] = useState(false);
  const [watching, setWatching] = useState(false);
  const lastHasClip = !!last && (recorder.last?.solveId === last.id || recorder.saved.has(last.id));
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
    forgetSolve(solve.id);
    toast(`Deleted ${formatSolve(solve)}`, { action: { label: "Undo", onClick: () => restoreSolve(solve) } });
  }

  const ao5 = averageOf(times, 5);
  const ao12 = averageOf(times, 12);
  const clockType = "font-clock text-[clamp(5.5rem,19vw,15rem)] leading-none lg:text-[clamp(6rem,11vw,12rem)]";
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
    <div className="grid w-full flex-1 lg:grid-cols-[18rem_minmax(0,1fr)_18rem] xl:grid-cols-[22rem_minmax(0,1fr)_22rem]">
      <section aria-label="Timer" className="relative flex min-h-[calc(100svh-var(--header-h)-var(--tabbar-h))] flex-col px-4 py-6 sm:px-6 lg:col-start-2 lg:px-2">
        {/* The whole timer area is the touch target, so phones can hold anywhere. It reaches up under the
            header so the clock in it is centred on the screen once the header fades out. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 -top-(--header-h) bottom-0 touch-none select-none"
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
              <MoveSequence
                key={scramble}
                alg={scramble}
                progress={guide?.kind === "on" ? guide : guide?.kind === "off" ? { done: guide.done } : guide?.kind === "scrambled" ? { done: Infinity } : undefined}
                className={cn("animate-in justify-center leading-snug duration-200 fade-in-0", scrambleSize)}
              />
            )}
          </div>
          {(cubeInput || cubeTrack) && <CubeGuideLine guide={guide} live={cubeReady} connected={cube.status === "connected"} />}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <SessionPicker />
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => newScramble(puzzle)}>
              <RefreshCwIcon data-icon="inline-start" />
              New scramble
            </Button>
            {!typing && <AddTimeButton onAdd={addTyped} />}
            <TimerSettingsButton settings={settings} />
          </div>
        </div>

        {/* The clock alone decides the centre; everything else hangs below it. */}
        <div className="pointer-events-none absolute inset-x-0 -top-(--header-h) bottom-0 flex items-center justify-center">
          <div className="relative">
            {typing ? (
              <div className="pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
                <TypedClock onAdd={addTyped} last={last ? formatSolve(last) : formatMs(0)} className={clockType} />
              </div>
            ) : (
              <output aria-live="off" aria-label="Time" className={cn(clockType, "block text-center whitespace-nowrap transition-colors duration-100", faceColor)}>
                {face}
              </output>
            )}
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
                    {last.moves && (
                      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setReplaying(true)}>
                        Replay
                      </Button>
                    )}
                    {lastHasClip && (
                      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setWatching(true)}>
                        {recorder.last?.solveId === last.id && recorder.last.save === "saved" ? "Clip (saved)" : "Clip"}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-missed" onClick={() => removeSolve(last)}>
                      Delete
                    </Button>
                  </>
                ) : typing ? null : cubeInput ? (
                  <p className="text-sm text-muted-foreground">Follow the scramble on the cube. Your first turn starts the clock; solving it stops it.</p>
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
              {filming && (recorder.camera === "blocked" || recorder.camera === "error") && (
                <p className="mt-1 text-sm text-missed" aria-live="polite">
                  {recorder.camera === "blocked" ? "Allow the camera to film your solves." : "Couldn't open the camera. Pick another in Settings."}
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
        className={cn("flex flex-col gap-5 border-t border-border px-4 py-6 sm:px-6 lg:col-start-3 lg:max-h-[calc(100svh-var(--header-h))] lg:border-t-0 lg:border-l", hideWhileTiming)}
      >
        <DailyCard runs={runs} armed={armedSize} onArm={(size) => setArmed(size === null ? null : { session: data.current, size })} />
        <SessionStats times={times} />
        <SolveList solves={solves} times={times} onDelete={removeSolve} />
      </aside>
      {replaying && last?.moves && <SolveReplay solve={last} open onOpenChange={setReplaying} />}
      {watching && last && <ClipDialog solve={last} open onOpenChange={setWatching} />}
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
  const supportsCube = useSmartCube().status !== "unsupported" || VIRTUAL_CUBE;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
        <Settings2Icon data-icon="inline-start" />
        Settings
      </PopoverTrigger>
      <PopoverContent className="max-h-[min(40rem,calc(100svh-6rem))] w-80 gap-4 overflow-y-auto p-4">
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
            <ToggleGroupItem value="typing" className={item}>Typing</ToggleGroupItem>
            {(supportsCube || settings.input === "cube") && <ToggleGroupItem value="cube" className={item}>Cube</ToggleGroupItem>}
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
        {(settings.input === "keyboard" || settings.input === "stackmat") && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            With a smart cube connected in a 3x3 session, the scramble still shows how far you are and the solve&apos;s turns are saved, so Analyze can split it
            and tag its OLL and PLL. The {settings.input === "stackmat" ? "Stackmat" : "keyboard"} keeps the time.
          </p>
        )}
        {settings.input === "cube" && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Connect a smart cube with the Bluetooth button at the top. The scramble shows how far you are; once it&apos;s scrambled, your first turn starts the
            clock and solving stops it. Its turns are saved, so Analyze can split the solve and tag its OLL and PLL.
          </p>
        )}
        {settings.input === "typing" && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Time with any clock, then type the result where the time goes and press Enter. 1234 is 12.34, 110234 is 11:02.34.
          </p>
        )}
        {settings.input !== "typing" && (
          <>
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
              {settings.input === "cube"
                ? "With inspection on, the 15 s countdown starts once the cube is scrambled."
                : `With inspection on, tap Space to start the 15 s countdown, then ${settings.input === "stackmat" ? "start the mat" : "hold to start"}.`}{" "}
              Starting after 15 s adds +2, after 17 s is a DNF.
            </p>
            {recordingSupported() && <VideoSettings settings={settings} open={open} />}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

const SAVE_RULES: { value: VideoSaveRule; label: string }[] = [
  { value: "none", label: "Only when I press Save" },
  { value: "all", label: "Every solve" },
  { value: "under", label: "Solves under a time" },
  { value: "top", label: "Top solves in the session" },
  { value: "pb", label: "New best single" },
];

/** Settings > Video: film each solve, from which camera, for how long after, and which clips to keep. */
function VideoSettings({ settings, open }: { settings: TimerSettings; open: boolean }) {
  const row = "flex items-center justify-between gap-4";
  const item = "px-2.5 aria-pressed:bg-foreground aria-pressed:text-background";
  const { camera } = useRecorder();
  // Camera names show once it's allowed.
  const cameras = useVideoInputs(`${open}-${camera}`);
  const devices = [{ value: "", label: "Default camera" }, ...cameras.map((d) => ({ value: d.id, label: d.label }))];
  const account = signedIn();
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className={row}>
        <span className="text-sm font-medium">Film solves</span>
        <ToggleGroup
          value={[settings.videoOn ? "on" : "off"]}
          onValueChange={(v) => v[0] && updateTimerSettings({ videoOn: v[0] === "on" })}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Film solves"
        >
          <ToggleGroupItem value="off" className={item}>Off</ToggleGroupItem>
          <ToggleGroupItem value="on" className={item}>On</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {settings.videoOn && (
        <>
          <Select items={devices} value={settings.videoDevice} onValueChange={(v) => updateTimerSettings({ videoDevice: (v as string | null) ?? "" })}>
            <SelectTrigger className="h-9 w-full" aria-label="Camera">
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
          <CameraPreview />
          <div className={row}>
            <span className="text-sm font-medium">Keep filming</span>
            <ToggleGroup
              value={[String(settings.videoTailMs)]}
              onValueChange={(v) => v[0] && updateTimerSettings({ videoTailMs: Number(v[0]) })}
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="Keep filming after the stop"
            >
              <ToggleGroupItem value="1000" className={item}>1 s</ToggleGroupItem>
              <ToggleGroupItem value="3000" className={item}>3 s</ToggleGroupItem>
              <ToggleGroupItem value="5000" className={item}>5 s</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Save automatically</span>
            <Select items={SAVE_RULES} value={settings.videoSave} disabled={!account} onValueChange={(v) => v && updateTimerSettings({ videoSave: v as VideoSaveRule })}>
              <SelectTrigger className="h-9 w-full" aria-label="Save automatically">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAVE_RULES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {account && settings.videoSave === "under" && (
              <label className="flex items-center gap-2 text-sm">
                Under
                <Input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={0.5}
                  className="h-8 w-20"
                  defaultValue={settings.videoUnderMs / 1000}
                  onChange={(e) => {
                    const sec = Number(e.target.value);
                    if (sec > 0) updateTimerSettings({ videoUnderMs: Math.round(sec * 1000) });
                  }}
                />
                seconds
              </label>
            )}
            {account && settings.videoSave === "top" && (
              <label className="flex items-center gap-2 text-sm">
                Among the best
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  step={1}
                  className="h-8 w-20"
                  defaultValue={settings.videoTopN}
                  onChange={(e) => {
                    const n = Math.round(Number(e.target.value));
                    if (n >= 1) updateTimerSettings({ videoTopN: Math.min(1000, n) });
                  }}
                />
                in the session
              </label>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Filming starts with inspection (or when you hold to start) and stops {settings.videoTailMs / 1000} s after the clock. Watch the clip under the time
            until your next solve starts; only saved clips stay.{" "}
            {account ? "A rule decides once, when the solve ends. DNFs are only saved by Every solve." : "Sign in to save clips to your account."}
          </p>
        </>
      )}
    </div>
  );
}

function CameraPreview() {
  const { camera } = useRecorder();
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = camera === "on" ? cameraStream() : null;
  }, [camera]);
  return (
    <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-muted">
      {camera === "on" ? (
        <video ref={ref} autoPlay playsInline muted className="size-full object-cover" />
      ) : (
        <p className={cn("px-3 text-center text-xs", camera === "blocked" || camera === "error" ? "text-missed" : "text-muted-foreground")}>
          {camera === "blocked" ? "Allow the camera so the page can film your solves." : camera === "error" ? "Couldn't open that camera. Pick another." : "Opening the camera…"}
        </p>
      )}
    </div>
  );
}

/** Under the scramble with a smart cube: what to do next. */
function CubeGuideLine({ guide, live, connected }: { guide: GuideStatus | null; live: boolean; connected: boolean }) {
  const line = "flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm";
  if (!connected) return <p className={cn(line, "text-muted-foreground")}>Connect your smart cube with the Bluetooth button at the top.</p>;
  if (!live) return <p className={cn(line, "text-muted-foreground")}>Smart cubes work in 3x3 sessions.</p>;
  if (!guide) return null;
  if (guide.kind === "off")
    return (
      <div className={cn(line, "text-missed")} aria-live="polite">
        Undo <MoveSequence alg={guide.fix} className="text-base" />
      </div>
    );
  if (guide.kind === "lost")
    return (
      <div className={cn(line, "pointer-events-auto text-muted-foreground")} onPointerDown={(e) => e.stopPropagation()}>
        Solve the cube to start this scramble, or if it is solved,
        <Button variant="outline" size="sm" onClick={markSolved}>
          Mark solved
        </Button>
      </div>
    );
  return null;
}
