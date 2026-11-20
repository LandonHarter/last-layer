import type { RealtimeChannel, RealtimeConnection } from "@mybase-dev/sdk/realtime";

/**
 * A smart cube shared between devices over mybase realtime. The device holding the
 * cube's Bluetooth link (a phone in Bluefy, say) is the "cube" side and sends its
 * turns; the "screen" side (a computer without working Bluetooth) uses them as if
 * the cube were connected to it. Both join one presence channel: the account's
 * (`presence:cube-user:<id>`, signed in on both) or a pairing code's
 * (`presence:cube-pair:<code>`, shown on the screen and typed on the cube side).
 */

export type RelayRole = "cube" | "screen";

/** A turn as the cube side saw it: its own `performance.now()` time, and the cube's clock. */
export type RelayTurn = { move: string; t: number; cube: number | null };

/** What the cube side sends, in order, in batches (`msgs` events). */
export type RelayMsg =
  | { type: "turn"; move: string; t: number; cube: number | null }
  | { type: "cube"; name: string; battery?: number; facelets: string }
  | { type: "battery"; battery: number };

/** What the screen side sends (`cmd` events). */
export type RelayCmd = { type: "want" } | { type: "reset" } | { type: "facelets" };

// ---------------------------------------------------------------------------
// Pairing codes: 6 characters, no 0/O or 1/I to mix up.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PAIR_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

export function newPairCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** What someone typed, as a code ("abc 234" → "ABC234"), or null. */
export function readPairCode(typed: string): string | null {
  const code = typed.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return PAIR_CODE_RE.test(code) ? code : null;
}

export const pairChannel = (code: string) => `presence:cube-pair:${code}`;
export const userChannel = (userId: string) => `presence:cube-user:${userId}`;

// ---------------------------------------------------------------------------

/**
 * Maps the cube side's clock to this one. Each message gives `now − t`, which is
 * the clocks' difference plus how long the message took; the smallest in the last
 * minute is the best guess, so a mapped time is never later than now.
 */
export class ClockOffset {
  private samples: { at: number; d: number }[] = [];
  constructor(private windowMs = 60_000) {}

  sample(remote: number, now: number) {
    this.samples.push({ at: now, d: now - remote });
    const cut = now - this.windowMs;
    while (this.samples.length > 1 && this.samples[0].at < cut) this.samples.shift();
  }

  /** The cube side's time on this clock (unchanged before any sample). */
  toLocal(remote: number): number {
    if (!this.samples.length) return remote;
    return remote + Math.min(...this.samples.map((s) => s.d));
  }

  reset() {
    this.samples = [];
  }
}

/**
 * Sends items in order, at most one batch in flight and batches at least `minGapMs`
 * apart, so fast turning stays under the socket's frame limit (20 a second). A
 * failed send is tried again until `stop`.
 */
export class Batcher<T> {
  private queue: T[] = [];
  private busy = false;
  private stopped = false;
  private last = -Infinity;

  constructor(
    private send: (items: T[]) => Promise<void>,
    private minGapMs = 60,
    private now: () => number = () => performance.now(),
    private wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  push(item: T) {
    if (this.stopped) return;
    this.queue.push(item);
    void this.flush();
  }

  stop() {
    this.stopped = true;
    this.queue = [];
  }

  private async flush() {
    if (this.busy || this.stopped || !this.queue.length) return;
    this.busy = true;
    try {
      const gap = this.last + this.minGapMs - this.now();
      if (gap > 0) await this.wait(gap);
      if (this.stopped) return;
      const items = this.queue.splice(0);
      this.last = this.now();
      try {
        await this.send(items);
      } catch {
        if (this.stopped) return;
        this.queue.unshift(...items);
        await this.wait(300);
      }
    } finally {
      this.busy = false;
    }
    void this.flush();
  }
}

// ---------------------------------------------------------------------------

export type Relay = {
  /** The channels joined: the code's and/or the account's. */
  channels: RealtimeChannel[];
  connection: RealtimeConnection;
  close(): void;
};

type TokenReply = { token: string; channels: string[]; apiUrl: string; project: string };

async function fetchToken(role: RelayRole, code?: string): Promise<TokenReply> {
  const params = new URLSearchParams({ role });
  if (code) params.set("code", code);
  const res = await fetch(`/api/cube-relay/token?${params}`);
  if (res.status === 401) throw new Error("Sign in, or use a pairing code.");
  if (!res.ok) throw new Error("Couldn't reach the relay. Try again.");
  return res.json();
}

/**
 * Joins the relay. With a code, only the code's channel (on the cube side) or the
 * code's plus the account's when signed in (on the screen side, so either works).
 */
export async function openRelay(role: RelayRole, code?: string, onlyCode = false): Promise<Relay> {
  const first = await fetchToken(role, code);
  const { connectRealtime } = await import("@mybase-dev/sdk/realtime");
  let pending: TokenReply | null = first;
  const connection = connectRealtime({
    apiUrl: first.apiUrl,
    project: first.project,
    token: async () => {
      const reply = pending ?? (await fetchToken(role, code));
      pending = null;
      return reply.token;
    },
  });
  const names = onlyCode && code ? [pairChannel(code)] : first.channels;
  const channels = names.map((n) => connection.channel(n));
  try {
    await Promise.all(channels.map((c) => c.ready()));
  } catch (e) {
    connection.close();
    throw e;
  }
  return {
    channels,
    connection,
    close: () => {
      channels.forEach((c) => c.unsubscribe());
      connection.close();
    },
  };
}

/** How many on the channel play `role` (presence info carries it). */
export function countRole(channel: RealtimeChannel, role: RelayRole): number {
  return channel.members().filter((m) => (m.info as { role?: string } | undefined)?.role === role).length;
}
