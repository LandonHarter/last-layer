"use client";

import { useSyncExternalStore } from "react";
import { applyAlg, solvedCube, type Face, type Sticker } from "../cube";
import { createStore } from "../store";
import type { RawMove } from "./moves";
import { fromFacelets, gripMap, reportsFor, SOLVED_FACELETS, toFacelets, toGrip } from "./state";

/**
 * The connected smart cube, shared by every page. The connection lives in this
 * module, so it lasts while you move between pages. The cube's state is
 * tracked from its turns (and its own report of its stickers, when it gives one).
 */

export type CubeStatus = "unsupported" | "idle" | "connecting" | "connected" | "error";

export type CubeSnapshot = {
  status: CubeStatus;
  error?: string;
  name?: string;
  battery?: number;
  /** The virtual cube (development only) rather than a real one. */
  virtual?: boolean;
  /** Tracked state as facelets; changes with every turn. */
  facelets: string;
  /** Asking for the cube's MAC address, which GAN cubes need to decrypt their messages. */
  macRequest?: { device: string };
};

export type CubeTurn = RawMove & { state: Sticker[] };

type Connection = { disconnect(): Promise<void>; requestFacelets?(): Promise<void>; reset?(): Promise<void> };

const supported = () => typeof navigator !== "undefined" && "bluetooth" in navigator;
let snapshot: CubeSnapshot = { status: supported() ? "idle" : "unsupported", facelets: SOLVED_FACELETS };
let state: Sticker[] = solvedCube();
let connection: Connection | null = null;
let macResolve: ((mac: string | null) => void) | null = null;
const listeners = new Set<() => void>();
const turnListeners = new Set<(t: CubeTurn) => void>();

function set(change: Partial<CubeSnapshot>) {
  snapshot = { ...snapshot, ...change };
  listeners.forEach((l) => l());
}

const SERVER: CubeSnapshot = { status: "unsupported", facelets: SOLVED_FACELETS };

export function useSmartCube(): CubeSnapshot {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => SERVER,
  );
}

export const cubeState = () => state;
export const cubeConnected = () => snapshot.status === "connected";

/** Every turn the cube reports, in the cube's own frame (white up, green front). */
export function onCubeTurn(cb: (t: CubeTurn) => void): () => void {
  turnListeners.add(cb);
  return () => turnListeners.delete(cb);
}

function turned(move: string, local: number, cube: number | null) {
  state = applyAlg(state, move);
  const facelets = toFacelets(state);
  set({ facelets });
  turnListeners.forEach((l) => l({ move, local, cube, state }));
}

function gotFacelets(facelets: string) {
  try {
    state = fromFacelets(facelets);
    set({ facelets });
  } catch {
    // A garbled report: keep tracking from turns.
  }
}

function dropped() {
  connection = null;
  set({ status: supported() ? "idle" : "unsupported", battery: undefined, name: undefined, virtual: undefined });
}

// ---------------------------------------------------------------------------
// MAC addresses, remembered per device in this browser only.

const MAC_KEY = "last-layer:cube-macs";
const MAC_RE = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;

function savedMac(device: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(MAC_KEY) ?? "{}") as Record<string, string>)[device] ?? null;
  } catch {
    return null;
  }
}

function saveMac(device: string, mac: string) {
  try {
    const all = JSON.parse(localStorage.getItem(MAC_KEY) ?? "{}") as Record<string, string>;
    localStorage.setItem(MAC_KEY, JSON.stringify({ ...all, [device]: mac }));
  } catch {
    // Not remembered; asked again next time.
  }
}

export const isMac = (v: string) => MAC_RE.test(v.trim());

/** Answer the MAC request (null cancels). */
export function answerMac(mac: string | null) {
  const resolve = macResolve;
  macResolve = null;
  set({ macRequest: undefined });
  resolve?.(mac && isMac(mac) ? mac.trim().toUpperCase().replace(/-/g, ":") : null);
}

// ---------------------------------------------------------------------------

export async function connectCube() {
  if (connection || snapshot.status === "connecting") return;
  set({ status: "connecting", error: undefined });
  try {
    const { connectGanCube } = await import("gan-web-bluetooth");
    let deviceName = "";
    const conn = await connectGanCube(async (device, fallback) => {
      deviceName = device.name ?? "GAN cube";
      const known = savedMac(deviceName);
      if (known) return known;
      if (!fallback) return null;
      set({ macRequest: { device: deviceName } });
      const mac = await new Promise<string | null>((resolve) => (macResolve = resolve));
      if (mac) saveMac(deviceName, mac);
      return mac;
    });
    let awaitingFacelets = true;
    conn.events$.subscribe((e) => {
      if (e.type === "MOVE") turned(e.move, e.localTimestamp ?? performance.now(), e.cubeTimestamp);
      else if (e.type === "FACELETS" && awaitingFacelets) {
        awaitingFacelets = false;
        gotFacelets(e.facelets);
      } else if (e.type === "BATTERY") set({ battery: e.batteryLevel });
      else if (e.type === "DISCONNECT") dropped();
    });
    connection = {
      disconnect: () => conn.disconnect(),
      requestFacelets: () => {
        awaitingFacelets = true;
        return conn.sendCubeCommand({ type: "REQUEST_FACELETS" });
      },
      reset: () => conn.sendCubeCommand({ type: "REQUEST_RESET" }),
    };
    set({ status: "connected", name: conn.deviceName || deviceName, virtual: false });
    await conn.sendCubeCommand({ type: "REQUEST_FACELETS" });
    await conn.sendCubeCommand({ type: "REQUEST_BATTERY" });
  } catch (e) {
    connection = null;
    const message = e instanceof Error ? e.message : String(e);
    // Closing the device chooser isn't an error worth showing.
    const cancelled = e instanceof DOMException && e.name === "NotFoundError";
    set({ status: cancelled ? "idle" : "error", error: cancelled ? undefined : message, macRequest: undefined });
  }
}

export async function disconnectCube() {
  const c = connection;
  connection = null;
  await c?.disconnect().catch(() => {});
  dropped();
}

/** The cube is solved now: tell it, and track from solved. */
export async function markSolved() {
  state = solvedCube();
  set({ facelets: SOLVED_FACELETS });
  await connection?.reset?.().catch(() => {});
}

/** Ask the cube for its stickers again. */
export async function resyncCube() {
  await connection?.requestFacelets?.().catch(() => {});
}

// ---------------------------------------------------------------------------
// Development: a virtual cube, turned from the console or by tests with
// `window.__smartcube.turn("R U R'", 100)`.

export const VIRTUAL_CUBE = process.env.NODE_ENV === "development";

export function connectVirtualCube() {
  if (!VIRTUAL_CUBE || connection) return;
  connection = { disconnect: async () => {} };
  set({ status: "connected", name: "Virtual cube", virtual: true, battery: 100 });
  const w = window as unknown as { __smartcube?: unknown };
  w.__smartcube = {
    /** Turn as someone holding `top` up and `front` in front would. */
    turn: async (alg: string, gapMs = 120, top: Face = "U", front: Face = "F") => {
      for (const move of reportsFor(alg, top, front)) {
        if (!connection) return;
        turned(move, performance.now(), null);
        if (gapMs) await new Promise((r) => setTimeout(r, gapMs));
      }
    },
    state: () => toFacelets(state),
  };
}

// ---------------------------------------------------------------------------
// How you hold the cube for algorithms. Drill and Learn map turns through it.

export type CubeSettings = { gripTop: Face; gripFront: Face };
const settingsStore = createStore<CubeSettings>("last-layer:smartcube:v1", { gripTop: "D", gripFront: "F" });
export const useCubeSettings = settingsStore.use;
export const updateCubeSettings = (change: Partial<CubeSettings>) => settingsStore.update((s) => ({ ...s, ...change }));

/** Turns in the hold for algorithms ("R" is the face on your right). */
export function onGripTurn(cb: (move: string, at: number) => void): () => void {
  return onCubeTurn((t) => {
    const { gripTop, gripFront } = settingsStore.read();
    let map;
    try {
      map = gripMap(gripTop, gripFront);
    } catch {
      map = gripMap("D", "F");
    }
    cb(toGrip(t.move, map), t.local);
  });
}
