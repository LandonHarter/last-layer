"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { signedIn } from "../storage";
import { CLIP_MAX_BYTES } from "./clip";

/**
 * Filming solves. One camera stream is kept open while the Timer wants it, so
 * a recording starts at once. Each solve is one recording: it starts with
 * inspection (or the hold), stops a little after the clock does, and becomes
 * the last clip. The last clip lives only in memory; starting the next
 * recording drops it unless it was saved (uploaded to the account).
 */

export type CameraStatus = "off" | "starting" | "on" | "blocked" | "error";
export type SaveStatus = "no" | "queued" | "saving" | "saved" | "error";

type Clip = {
  solveId: string | null;
  mime: string;
  startedAt: number;
  stoppedAt: number;
  /** Where in the video the clock stopped, ms from its start; null until it does. */
  stopMs: number | null;
  /** Still filming: before the clock stops, or the few seconds after it. */
  recording: boolean;
  blob: Blob | null;
  url: string | null;
  save: SaveStatus;
  /** Upload progress, 0 to 1. */
  progress: number;
  error?: string;
};

export type LastClip = Readonly<Omit<Clip, "blob">> & { durationMs: number };

type Snapshot = {
  camera: CameraStatus;
  /** Filming a solve right now (the clock hasn't stopped yet). */
  live: boolean;
  last: LastClip | null;
  /** Solves with a video saved to the account. */
  saved: ReadonlySet<string>;
};

let stream: MediaStream | null = null;
let streamDevice: string | null = null;
let camera: CameraStatus = "off";
let recorder: MediaRecorder | null = null;
let current: Clip | null = null;
let last: Clip | null = null;
let tailTimer: number | undefined;
let saved = new Set<string>();
let savedLoaded = false;

const listeners = new Set<() => void>();
let snapshot: Snapshot = { camera, live: false, last: null, saved };
const SERVER_SNAPSHOT: Snapshot = snapshot;

function emit() {
  snapshot = {
    camera,
    live: current !== null && current.stoppedAt === 0,
    last: last && { ...last, blob: undefined, durationMs: (last.stoppedAt || Date.now()) - last.startedAt },
    saved,
  } as Snapshot;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  loadSaved();
  return () => listeners.delete(l);
}

export const useRecorder = () => useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
export const cameraStream = () => stream;

export const recordingSupported = () => typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;

// ---------------------------------------------------------------------------
// The camera

let opening: Promise<void> | null = null;

/** Open the camera (again, if it's another one). */
export function openCamera(deviceId: string): Promise<void> {
  if (!recordingSupported()) return Promise.resolve();
  if (stream && streamDevice === deviceId && camera === "on") return Promise.resolve();
  const run = async () => {
    if (current) discardCurrent();
    stopStream();
    camera = "starting";
    emit();
    try {
      const video: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
      if (deviceId) video.deviceId = { exact: deviceId };
      stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      streamDevice = deviceId;
      camera = "on";
    } catch (e) {
      camera = (e as Error).name === "NotAllowedError" ? "blocked" : "error";
    }
    emit();
  };
  opening = (opening ?? Promise.resolve()).then(run, run);
  return opening;
}

function stopStream() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  streamDevice = null;
}

export function closeCamera() {
  if (current) discardCurrent();
  stopStream();
  camera = "off";
  emit();
}

/** Opens the camera while `on`, and closes it when the Timer goes away. */
export function useCamera(on: boolean, deviceId: string) {
  useEffect(() => {
    if (!on) return;
    openCamera(deviceId);
    return () => closeCamera();
  }, [on, deviceId]);
}

/** The cameras this browser has. Names show once the camera is allowed, so look again when `refreshKey` changes. */
export function useVideoInputs(refreshKey: unknown): VideoInput[] {
  const [list, setList] = useState<VideoInput[]>([]);
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    let live = true;
    const load = () =>
      navigator.mediaDevices.enumerateDevices().then((all) => {
        if (live) setList(all.filter((d) => d.kind === "videoinput" && d.deviceId).map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` })));
      });
    load();
    navigator.mediaDevices.addEventListener("devicechange", load);
    return () => {
      live = false;
      navigator.mediaDevices.removeEventListener("devicechange", load);
    };
  }, [refreshKey]);
  return list;
}
export type VideoInput = { id: string; label: string };

// ---------------------------------------------------------------------------
// Recording

const MIMES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
const pickMime = () => MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";

/** Start filming a solve. Drops the last clip unless it is saved or being saved. */
export function startRecording() {
  if (!stream || camera !== "on") return;
  if (current && current.stoppedAt === 0) return;
  // Still filming the tail of the last solve: end it now.
  if (current) finishRecorder();
  dropLast();
  const mime = pickMime();
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 2_000_000 });
  } catch {
    return;
  }
  const clip: Clip = { solveId: null, mime: (rec.mimeType || mime || "video/webm").split(";")[0], startedAt: Date.now(), stoppedAt: 0, stopMs: null, recording: true, blob: null, url: null, save: "no", progress: 0 };
  const chunks: Blob[] = [];
  // The first frame comes a moment after start(); time the video from there.
  rec.onstart = () => {
    clip.startedAt = Date.now();
  };
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    clip.recording = false;
    clip.blob = new Blob(chunks, { type: clip.mime });
    // Dropped while filming (cancelled, or the next solve began and it wasn't kept).
    if (clip !== last && clip.save !== "queued") return emit();
    if (clip === last) clip.url = URL.createObjectURL(clip.blob);
    if (clip.save === "queued") upload(clip);
    emit();
  };
  rec.start(1000);
  recorder = rec;
  current = clip;
  emit();
}

/** The clock stopped: keep filming for `tailMs`, then the clip is the last one. */
export function stopRecording(solveId: string, tailMs: number, save: boolean) {
  const clip = current;
  if (!clip || clip.stoppedAt !== 0) return;
  clip.solveId = solveId;
  clip.stopMs = Date.now() - clip.startedAt;
  clip.stoppedAt = Date.now() + tailMs;
  if (save) clip.save = "queued";
  last = clip;
  window.clearTimeout(tailTimer);
  tailTimer = window.setTimeout(finishRecorder, tailMs);
  emit();
}

function finishRecorder() {
  window.clearTimeout(tailTimer);
  if (current) current.stoppedAt = Math.min(current.stoppedAt || Date.now(), Date.now());
  if (recorder && recorder.state !== "inactive") recorder.stop();
  recorder = null;
  current = null;
}

function discardCurrent() {
  const clip = current;
  finishRecorder();
  if (clip && clip !== last) clip.save = "no";
}

/** The solve was cancelled before the clock stopped: throw the recording away. */
export function cancelRecording() {
  if (!current || current.stoppedAt !== 0) return;
  discardCurrent();
  emit();
}

function dropLast() {
  if (!last) return;
  if (last.url) URL.revokeObjectURL(last.url);
  // A clip on its way up keeps going without being shown.
  last = null;
}

// ---------------------------------------------------------------------------
// Saving

/** Save the last clip to the account (once it has finished filming). */
export function saveLast() {
  const clip = last;
  if (!clip || !clip.solveId || clip.save === "saving" || clip.save === "saved") return;
  if (clip.recording) {
    clip.save = "queued";
    return emit();
  }
  upload(clip);
}

async function upload(clip: Clip) {
  const solveId = clip.solveId;
  const blob = clip.blob;
  if (!solveId || !blob) return;
  const fail = (msg: string) => {
    clip.save = "error";
    clip.error = msg;
    emit();
  };
  if (!signedIn()) return fail("Sign in to save clips.");
  if (blob.size > CLIP_MAX_BYTES) return fail("This clip is over 95 MB, too large to save.");
  clip.save = "saving";
  clip.progress = 0;
  emit();
  try {
    const start = await fetch("/api/clips", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ solveId, mime: clip.mime, bytes: blob.size }) });
    if (!start.ok) return fail((await start.json().catch(() => null))?.error ?? "Couldn't start the upload.");
    const { url } = (await start.json()) as { url: string };
    await put(url, blob, clip.mime, (p) => {
      clip.progress = p;
      emit();
    });
    const done = await fetch(`/api/clips/${encodeURIComponent(solveId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mime: clip.mime, durationMs: clip.stoppedAt - clip.startedAt, stopMs: clip.stopMs }),
    });
    if (!done.ok) return fail((await done.json().catch(() => null))?.error ?? "Couldn't save the clip.");
    clip.save = "saved";
    clip.progress = 1;
    saved = new Set(saved).add(solveId);
    // Once saved and no longer shown, the browser can let it go.
    if (clip !== last) clip.blob = null;
    emit();
  } catch {
    fail("Upload failed. Check your connection and try again.");
  }
}

function put(url: string, blob: Blob, mime: string, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", mime);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status))));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(blob);
  });
}

function loadSaved() {
  if (savedLoaded || typeof window === "undefined" || !signedIn()) return;
  savedLoaded = true;
  fetch("/api/clips")
    .then((r) => (r.ok ? r.json() : null))
    .then((body: { solveIds?: string[] } | null) => {
      if (!body?.solveIds) return;
      saved = new Set([...saved, ...body.solveIds]);
      emit();
    })
    .catch(() => {
      savedLoaded = false;
    });
}

/** A URL to play a saved clip. */
export async function savedClip(solveId: string): Promise<{ url: string; mime: string; stopMs: number | null }> {
  const r = await fetch(`/api/clips/${encodeURIComponent(solveId)}`);
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "Couldn't load the clip.");
  return r.json();
}

/** Delete a saved clip from the account. The solve stays. */
export async function deleteSavedClip(solveId: string) {
  const r = await fetch(`/api/clips/${encodeURIComponent(solveId)}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Couldn't delete the clip.");
  saved = new Set(saved);
  saved.delete(solveId);
  if (last?.solveId === solveId) last.save = "no";
  emit();
}

/** A deleted solve's clip goes with it on the server; forget it here too. */
export function forgetSolve(solveId: string) {
  if (last?.solveId === solveId && !last.recording) dropLast();
  if (saved.has(solveId)) {
    saved = new Set(saved);
    saved.delete(solveId);
  }
  emit();
}
