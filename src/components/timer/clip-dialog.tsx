"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DownloadIcon, PauseIcon, PlayIcon, StepBackIcon, StepForwardIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { signInWithGoogle } from "@/lib/auth-client";
import { formatMs, formatSolve, useTimerSettings, type Solve } from "@/lib/solves";
import { signedIn } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { clipExt } from "@/lib/video/clip";
import { deleteSavedClip, saveLast, savedClip, useRecorder } from "@/lib/video/recorder";
import { buildTimeline, clockAt, segmentAt, type ClockFace, type Segment, type SegmentKind, type Timeline } from "@/lib/video/timeline";

/**
 * Watch a solve's video: the clip just filmed (from memory, until the next
 * solve starts) or one saved to the account. The just-filmed clip can be saved.
 */
export function ClipDialog({ solve, open, onOpenChange }: { solve: Solve; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { last, saved } = useRecorder();
  const local = last?.solveId === solve.id ? last : null;
  const isSaved = saved.has(solve.id) || local?.save === "saved";
  const [remote, setRemote] = useState<{ id: string; url: string | null; stopMs: number | null; error?: string } | null>(null);

  // Not in memory any more: load the saved one.
  const needRemote = open && !local?.url && isSaved;
  useEffect(() => {
    if (!needRemote) return;
    let live = true;
    savedClip(solve.id).then(
      (c) => live && setRemote({ id: solve.id, url: c.url, stopMs: c.stopMs }),
      (e: Error) => live && setRemote({ id: solve.id, url: null, stopMs: null, error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [needRemote, solve.id]);

  const mine = remote?.id === solve.id ? remote : null;
  const src = local?.url ?? mine?.url ?? null;
  const stopMs = local?.url ? local.stopMs : (mine?.stopMs ?? null);

  async function remove() {
    try {
      await deleteSavedClip(solve.id);
      toast("Deleted the saved clip");
      if (!local?.url) onOpenChange(false);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  let status: React.ReactNode = null;
  if (local?.recording) status = local.save === "queued" ? "Still filming. It will be saved when it stops." : "Still filming the last few seconds…";
  else if (local?.save === "saving") status = `Saving… ${Math.round(local.progress * 100)}%`;
  else if (local?.save === "error") status = <span className="text-missed">{local.error}</span>;
  else if (local && !isSaved) status = "Not saved. Starting the next solve drops it.";
  else if (isSaved) status = "Saved to your account.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94svh] gap-5 overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold tracking-tight">Clip of {formatSolve(solve)}</DialogTitle>
          <DialogDescription>{status}</DialogDescription>
        </DialogHeader>

        {src ? (
          <ClipPlayer key={src} src={src} solve={solve} stopMs={stopMs} />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-muted">
            <p className="px-4 text-center text-sm text-muted-foreground">
              {mine?.error ?? (local?.recording ? "Filming…" : isSaved ? "Loading…" : "This clip is gone. Only saved clips stay after the next solve.")}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {local && !isSaved && local.save !== "saving" && local.save !== "queued" &&
            (signedIn() ? (
              <Button onClick={saveLast}>{local.save === "error" ? "Try again" : "Save clip"}</Button>
            ) : (
              <Button variant="outline" onClick={() => signInWithGoogle()}>
                Sign in to save clips
              </Button>
            ))}
          {local?.save === "saving" && (
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Saving" aria-valuenow={Math.round(local.progress * 100)}>
              <div className="h-full bg-primary transition-[width]" style={{ width: `${local.progress * 100}%` }} />
            </div>
          )}
          {src && (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              nativeButton={false}
              render={<a href={src} download={`solve-${formatSolve(solve).replace(/[^0-9a-zA-Z.+]/g, "")}.${clipExt(local?.mime ?? "video/webm")}`} />}
            >
              <DownloadIcon data-icon="inline-start" />
              Download
            </Button>
          )}
          {isSaved && (
            <Button variant="ghost" className="ml-auto text-muted-foreground hover:text-missed" onClick={remove}>
              Delete clip
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

const FRAME_MS = 1000 / 30;
const RATES = ["0.25", "0.5", "1"] as const;
type Rate = (typeof RATES)[number];
const RATE_LABEL: Record<Rate, string> = { "0.25": "¼×", "0.5": "½×", "1": "1×" };

/** Colour of each part of the solve: the CFOP steps take the chart series, in order. */
const SOLID: Partial<Record<SegmentKind, string>> = { cross: "bg-chart-1", f2l: "bg-chart-2", oll: "bg-chart-3", pll: "bg-chart-4", solve: "bg-chart-1" };
const SOFT: Partial<Record<SegmentKind, string>> = { cross: "bg-chart-1/35", f2l: "bg-chart-2/35", oll: "bg-chart-3/35", pll: "bg-chart-4/35", solve: "bg-chart-1/35" };
/** Inspection isn't timed, so it is hatched rather than filled. */
const HATCH = { backgroundImage: "repeating-linear-gradient(135deg, var(--muted-foreground) 0 1.5px, transparent 1.5px 6px)", opacity: 0.55 };

const FACE_TONE: Record<ClockFace["tone"], string> = {
  idle: "text-muted-foreground",
  inspect: "text-foreground",
  "inspect-late": "text-learning",
  "inspect-over": "text-missed",
  running: "text-foreground",
  done: "text-foreground",
};

function ClipPlayer({ src, solve, stopMs }: { src: string; solve: Solve; stopMs: number | null }) {
  const { videoTailMs } = useTimerSettings();
  const video = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<Rate>("1");

  const timeline = useMemo(() => (duration ? buildTimeline(solve, stopMs, duration, videoTailMs) : null), [solve, stopMs, duration, videoTailMs]);
  const face = timeline ? clockAt(timeline, solve, t) : null;

  // The clock face needs every frame, not the few timeupdate events a second.
  useEffect(() => {
    if (!playing) return;
    let frame = requestAnimationFrame(function tick() {
      if (video.current) setT(video.current.currentTime * 1000);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const seek = useCallback((ms: number) => {
    const v = video.current;
    if (!v) return;
    const end = Number.isFinite(v.duration) ? v.duration * 1000 : ms;
    const to = Math.max(0, Math.min(end, ms));
    v.currentTime = to / 1000;
    setT(to);
  }, []);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      if (v.ended) v.currentTime = 0;
      v.play().catch(() => {});
    } else v.pause();
  }, []);

  const step = useCallback(
    (frames: number) => {
      video.current?.pause();
      seek((video.current?.currentTime ?? 0) * 1000 + frames * FRAME_MS);
    },
    [seek],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, [role=slider]")) return;
    const k = e.key.toLowerCase();
    if (k === "k" || (k === " " && !target.closest("button, a"))) toggle();
    else if (k === ",") step(-1);
    else if (k === ".") step(1);
    else if (k === "j") seek(t - 1000);
    else if (k === "l") seek(t + 1000);
    else return;
    e.preventDefault();
  }

  return (
    <div className="flex flex-col gap-4" onKeyDown={onKeyDown}>
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video
          ref={video}
          src={src}
          autoPlay
          playsInline
          muted
          onClick={toggle}
          onLoadedMetadata={fixDuration}
          onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration * 1000)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onSeeked={(e) => setT(e.currentTarget.currentTime * 1000)}
          onTimeUpdate={(e) => !playing && setT(e.currentTarget.currentTime * 1000)}
          className="aspect-video w-full cursor-pointer object-contain"
        />
        {face && (
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-background/85 px-2.5 pt-1.5 pb-2 shadow-sm backdrop-blur-md sm:bottom-4 sm:left-4 sm:rounded-xl sm:px-4 sm:pt-2 sm:pb-2.5">
            <div className={cn("font-clock text-[clamp(1.75rem,7vw,4.25rem)] leading-none transition-colors duration-100", FACE_TONE[face.tone])}>{face.text}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold sm:mt-1.5 sm:text-sm">
              <Swatch kind={face.kind} />
              <span className="text-muted-foreground">{face.phase}</span>
            </div>
          </div>
        )}
        {!playing && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur-md">
              <PlayIcon className="size-6 translate-x-px fill-current" />
            </span>
          </div>
        )}
      </div>

      {timeline && <Track timeline={timeline} solve={solve} t={t} onSeek={seek} />}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <PauseIcon className="fill-current" /> : <PlayIcon className="fill-current" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Back one frame">
            <StepBackIcon />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label="Forward one frame">
            <StepForwardIcon />
          </Button>
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatMs(t)} / {duration ? formatMs(duration) : "–"} s
        </span>
        <ToggleGroup
          value={[rate]}
          onValueChange={(v) => {
            if (!v[0]) return;
            setRate(v[0] as Rate);
            if (video.current) video.current.playbackRate = Number(v[0]);
          }}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Speed"
          className="ml-auto"
        >
          {RATES.map((r) => (
            <ToggleGroupItem key={r} value={r} className="px-2.5 aria-pressed:bg-foreground aria-pressed:text-background">
              {RATE_LABEL[r]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {timeline && <Splits timeline={timeline} t={t} onSeek={seek} />}
    </div>
  );
}

function Swatch({ kind, className }: { kind: SegmentKind; className?: string }) {
  if (kind === "inspection") return <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-[3px] bg-muted", className)} style={HATCH} />;
  return <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-[3px]", SOLID[kind] ?? "bg-muted-foreground/40", className)} />;
}

const pct = (ms: number, tl: Timeline) => `${(ms / tl.duration) * 100}%`;

/** The clip as a strip: one stretch per part of the solve, with a playhead. Drag or use the arrow keys to move through it. */
function Track({ timeline: tl, solve, t, onSeek }: { timeline: Timeline; solve: Solve; t: number; onSeek: (ms: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const dragging = useRef(false);
  const at = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * tl.duration;
  };
  const face = clockAt(tl, solve, t);
  const hoverFace = hover === null ? null : clockAt(tl, solve, hover);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Position in the clip"
        aria-valuemin={0}
        aria-valuemax={Math.round(tl.duration)}
        aria-valuenow={Math.round(t)}
        aria-valuetext={`${face.phase}, ${face.text}`}
        className="relative h-11 cursor-pointer touch-none rounded-lg outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = true;
          onSeek(at(e));
        }}
        onPointerMove={(e) => {
          const ms = at(e);
          setHover(ms);
          if (dragging.current) onSeek(ms);
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          const big = e.shiftKey ? 1000 : 100;
          if (e.key === "ArrowLeft") onSeek(t - big);
          else if (e.key === "ArrowRight") onSeek(t + big);
          else if (e.key === "Home") onSeek(0);
          else if (e.key === "End") onSeek(tl.duration);
          else return;
          e.preventDefault();
        }}
      >
        <div className="absolute inset-0 overflow-hidden rounded-lg bg-muted">
          {tl.segments.map((s, i) => (
            <SegmentBar key={i} s={s} tl={tl} />
          ))}
          {tl.ticks.map((tick, i) => (
            <span key={i} aria-hidden="true" className="absolute inset-y-2 w-px bg-background/80" style={{ left: pct(tick, tl) }} />
          ))}
        </div>
        {hover !== null && hoverFace && (
          <div
            className="pointer-events-none absolute bottom-full mb-3 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs font-semibold whitespace-nowrap text-background tabular-nums"
            style={{ left: pct(hover, tl) }}
          >
            {hoverFace.phase} {hoverFace.tone === "idle" ? "" : hoverFace.text}
          </div>
        )}
        <div aria-hidden="true" className="pointer-events-none absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: pct(t, tl) }}>
          <span className="absolute -top-1 left-1/2 size-3 -translate-x-1/2 rounded-full bg-foreground ring-2 ring-background" />
        </div>
      </div>
      {/* Where the clock started and stopped: the clip's own seconds mean little to a cuber. */}
      <div className="relative h-4 text-[11px] font-medium text-muted-foreground tabular-nums">
        {tl.inspectStart !== null && tl.inspectStart > tl.duration * 0.04 && <Mark at={tl.inspectStart} tl={tl} label="Inspect" />}
        <Mark at={tl.clockStart} tl={tl} label="Start" />
        <Mark at={tl.stop} tl={tl} label="Stop" />
      </div>
    </div>
  );
}

function Mark({ at, tl, label }: { at: number; tl: Timeline; label: string }) {
  const p = at / tl.duration;
  return (
    <span className={cn("absolute top-0 whitespace-nowrap", p > 0.9 ? "-translate-x-full" : p > 0.06 && "-translate-x-1/2")} style={{ left: pct(at, tl) }}>
      {label}
    </span>
  );
}

function SegmentBar({ s, tl }: { s: Segment; tl: Timeline }) {
  if (s.to <= s.from || s.kind === "ready" || s.kind === "after") return null;
  const edge = s.from > 0 ? "border-l-2 border-background" : "";
  const box = { left: pct(s.from, tl), width: pct(s.to - s.from, tl) };
  if (s.kind === "inspection")
    return (
      <div className={cn("absolute inset-y-0", edge)} style={box}>
        <div className="size-full" style={HATCH} />
      </div>
    );
  const recog = s.recogTo !== undefined && s.kind !== "cross" ? s.recogTo - s.from : 0;
  return (
    <div className={cn("absolute inset-y-0 flex", edge)} style={box}>
      {recog > 0 && <div className={cn("h-full", SOFT[s.kind])} style={{ width: `${(recog / (s.to - s.from)) * 100}%` }} />}
      <div className={cn("h-full flex-1", SOLID[s.kind])} />
    </div>
  );
}

/** The parts of the solve with their times. Each one jumps the clip to where it starts. */
function Splits({ timeline: tl, t, onSeek }: { timeline: Timeline; t: number; onSeek: (ms: number) => void }) {
  const parts = tl.segments.filter((s) => s.kind !== "ready" && s.kind !== "after");
  const now = segmentAt(tl, t);
  return (
    <ol className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap" aria-label="Splits">
      {parts.map((s, i) => {
        const recog = s.recogTo !== undefined && s.kind !== "cross" ? s.recogTo - s.from : 0;
        return (
          <li key={i} className="sm:min-w-28 sm:flex-1">
            <button
              type="button"
              onClick={() => onSeek(s.from)}
              aria-current={now === s ? "step" : undefined}
              className="flex w-full flex-col items-start gap-1 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=step]:bg-muted"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Swatch kind={s.kind} />
                {s.label}
              </span>
              <span className="font-clock text-2xl leading-none">{s.skipped ? "Skip" : formatMs(s.to - s.from)}</span>
              {recog > 0 && !s.skipped && (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {formatMs(recog)} look, {formatMs(s.to - s.from - recog)} turn
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * MediaRecorder WebM files have no duration, so the browser says Infinity and
 * the scrubber doesn't work. Seeking far past the end makes it read the real
 * length; then go back to the start.
 */
function fixDuration(e: React.SyntheticEvent<HTMLVideoElement>) {
  const v = e.currentTarget;
  if (Number.isFinite(v.duration)) return;
  const back = () => {
    if (!Number.isFinite(v.duration)) return;
    v.removeEventListener("durationchange", back);
    v.currentTime = 0;
  };
  v.addEventListener("durationchange", back);
  v.currentTime = 1e101;
}
