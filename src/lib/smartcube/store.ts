"use client";

import { useSyncExternalStore } from "react";
import { applyAlg, solvedCube, type Face, type Sticker } from "../cube";
import { createStore } from "../store";
import type { RawMove } from "./moves";
import { Batcher, ClockOffset, countRole, newPairCode, openRelay, type Relay, type RelayCmd, type RelayMsg } from "./relay";
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
  /** Using a cube connected on another device. `waiting` until that device sends it. */
  remote?: { code: string; waiting: boolean };
  /** Sending this cube to other devices; `screens` is how many are listening. */
  sharing?: { code?: string; screens: number; error?: string };
};

export type CubeTurn = RawMove & { state: Sticker[] };

type Connection = { disconnect(): Promise<void>; requestFacelets?(): Promise<void>; reset?(): Promise<void> };

export const webBluetooth = () => typeof navigator !== "undefined" && "bluetooth" in navigator;
let snapshot: CubeSnapshot = { status: webBluetooth() ? "idle" : "unsupported", facelets: SOLVED_FACELETS };
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
    share?.sendState();
  } catch {
    // A garbled report: keep tracking from turns.
  }
}

function gotBattery(battery: number) {
  set({ battery });
  share?.batcher.push({ type: "battery", battery });
}

function dropped() {
  connection = null;
  stopSharing();
  set({ status: webBluetooth() ? "idle" : "unsupported", battery: undefined, name: undefined, virtual: undefined, remote: undefined });
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
      } else if (e.type === "BATTERY") gotBattery(e.batteryLevel);
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
  share?.sendState();
  await connection?.reset?.().catch(() => {});
}

/** Ask the cube for its stickers again. */
export async function resyncCube() {
  await connection?.requestFacelets?.().catch(() => {});
}

// ---------------------------------------------------------------------------
// The relay (`relay.ts`): use a cube connected on another device, or send this one.

/**
 * Use the cube another device has connected and is sharing. Listens on a new pairing
 * code's channel and, signed in, the account's, so either way of sharing finds it.
 */
export async function connectRemoteCube() {
  if (connection || snapshot.status === "connecting") return;
  const code = newPairCode();
  set({ status: "connecting", error: undefined, remote: { code, waiting: true } });
  let relay: Relay;
  try {
    relay = await openRelay("screen", code);
  } catch (e) {
    set({ status: "error", error: e instanceof Error ? e.message : String(e), remote: undefined });
    return;
  }
  // Another connect or a cancel won while the relay opened.
  if (connection || snapshot.remote?.code !== code) return relay.close();

  const offset = new ClockOffset();
  // The channel the cube side was last heard on; commands go there.
  let active = relay.channels[0];
  let live = false;
  const waiting = () => {
    live = false;
    offset.reset();
    set({ status: "connecting", remote: { code, waiting: true } });
  };
  const ask = (cmd: RelayCmd) => active.publish("cmd", cmd).catch(() => {});

  for (const channel of relay.channels) {
    channel.on<{ msgs: RelayMsg[] }>("msgs", ({ msgs }) => {
      active = channel;
      const now = performance.now();
      for (const m of msgs) if (m.type === "turn") offset.sample(m.t, now);
      for (const m of msgs) {
        if (m.type === "cube") {
          gotFacelets(m.facelets);
          live = true;
          set({ status: "connected", name: m.name, battery: m.battery, virtual: false, remote: { code, waiting: false } });
        } else if (m.type === "battery") set({ battery: m.battery });
        else if (live) turned(m.move, offset.toLocal(m.t), m.cube);
      }
    });
    channel.on("bye", () => channel === active && waiting());
    channel.onPresence(({ action, member }) => {
      const role = (member.info as { role?: string } | undefined)?.role;
      if (role !== "cube") return;
      if (action === "join") channel.publish("cmd", { type: "want" } satisfies RelayCmd).catch(() => {});
      else if (channel === active && countRole(channel, "cube") === 0) waiting();
    });
    channel.publish("cmd", { type: "want" } satisfies RelayCmd).catch(() => {});
  }
  // After a reconnect, ask for the cube again (turns may have been missed).
  relay.connection.on("state", (s) => {
    if (s !== "open") return;
    for (const c of relay.channels) c.ready().then(() => c.publish("cmd", { type: "want" } satisfies RelayCmd)).catch(() => {});
  });

  connection = {
    disconnect: async () => relay.close(),
    requestFacelets: () => ask({ type: "facelets" }),
    reset: () => ask({ type: "reset" }),
  };
}

let share: { relay: Relay; batcher: Batcher<RelayMsg>; sendState(): void; stop(): void } | null = null;

/** Send this device's cube to other devices: with a code from the other device, or (no code) to the account's. */
export async function shareCube(code?: string) {
  if (share || snapshot.status !== "connected" || snapshot.remote) return;
  set({ sharing: { code, screens: 0 } });
  let relay: Relay;
  try {
    relay = await openRelay("cube", code, true);
  } catch (e) {
    set({ sharing: { code, screens: 0, error: e instanceof Error ? e.message : String(e) } });
    return;
  }
  // Stopped (or the cube dropped) while the relay opened.
  if (!snapshot.sharing || snapshot.sharing.code !== code || snapshot.status !== "connected") return relay.close();

  const channel = relay.channels[0];
  const batcher = new Batcher<RelayMsg>((msgs) => channel.publish("msgs", { msgs }));
  const sendState = () =>
    batcher.push({ type: "cube", name: snapshot.name ?? "Smart cube", battery: snapshot.battery, facelets: toFacelets(state) });
  const offTurn = onCubeTurn((t) => batcher.push({ type: "turn", move: t.move, t: t.local, cube: t.cube }));
  const screens = () => set({ sharing: { code, screens: countRole(channel, "screen") } });
  const offPresence = channel.onPresence(screens);
  const offCmd = channel.on<RelayCmd>("cmd", (cmd) => {
    if (cmd.type === "want") sendState();
    else if (cmd.type === "reset") void markSolved();
    else if (cmd.type === "facelets") void resyncCube();
  });
  const offState = relay.connection.on("state", (s) => {
    if (s === "open") channel.ready().then(() => (sendState(), screens())).catch(() => {});
  });

  share = {
    relay,
    batcher,
    sendState,
    stop: () => {
      offTurn();
      offPresence();
      offCmd();
      offState();
      batcher.stop();
      // Say goodbye before closing, so the screen doesn't wait for presence to time out.
      channel.publish("bye").catch(() => {}).finally(() => relay.close());
    },
  };
  sendState();
  screens();
}

export function stopSharing() {
  const s = share;
  share = null;
  s?.stop();
  if (snapshot.sharing) set({ sharing: undefined });
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
