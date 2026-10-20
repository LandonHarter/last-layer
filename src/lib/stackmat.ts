/**
 * Decodes a Stackmat timer from its audio cable (the 3.5 mm "data" port into
 * a microphone or line input). The timer sends a short packet about ten times
 * a second as 1200 baud serial, 8 data bits, no parity, one stop bit:
 *
 *   status, 5 or 6 digits (M SS hh or M SS mmm), checksum (64 + sum of digits), "\n", "\r"
 *
 * Gen 2 timers send 5 digits (hundredths), gen 3 and later 6 (thousandths).
 * Sound cards may flip the signal, so two decoders run side by side, one for
 * each polarity, and whichever one produces valid packets wins.
 */

export type StackmatStatus =
  /** Reset, nothing on the clock. */
  | "I"
  /** Both hands down long enough: lift to start (green light). */
  | "A"
  /** Running. */
  | " "
  /** Stopped. */
  | "S"
  /** Left hand down. */
  | "L"
  /** Right hand down. */
  | "R"
  /** Both hands down, not ready yet. */
  | "C";

export type StackmatPacket = { status: StackmatStatus; ms: number };

const STATUSES = new Set<string>(["I", "A", " ", "S", "L", "R", "C"]);
const BAUD = 1200;

/** Parse the bytes of one packet, ending in "\n\r". Null if it isn't a valid one. */
export function parsePacket(bytes: number[]): StackmatPacket | null {
  const n = bytes.length;
  if ((n !== 9 && n !== 10) || bytes[n - 2] !== 0x0a || bytes[n - 1] !== 0x0d) return null;
  const status = String.fromCharCode(bytes[0]);
  if (!STATUSES.has(status)) return null;
  const digits = bytes.slice(1, n - 3).map((b) => b - 0x30);
  if (digits.some((d) => d < 0 || d > 9)) return null;
  if (bytes[n - 3] !== 64 + digits.reduce((a, b) => a + b, 0)) return null;
  const [m, s1, s2, f1, f2, f3 = 0] = digits;
  if (s1 > 5) return null;
  return { status: status as StackmatStatus, ms: m * 60000 + (s1 * 10 + s2) * 1000 + f1 * 100 + f2 * 10 + f3 };
}

/** Build a packet's bytes, for tests. */
export function encodePacket(status: StackmatStatus, ms: number, digitCount: 5 | 6 = 6): number[] {
  const m = Math.floor(ms / 60000) % 10;
  const s = Math.floor(ms / 1000) % 60;
  const f = ms % 1000;
  const digits = [m, Math.floor(s / 10), s % 10, Math.floor(f / 100), Math.floor(f / 10) % 10, f % 10].slice(0, digitCount);
  return [status.charCodeAt(0), ...digits.map((d) => d + 0x30), 64 + digits.reduce((a, b) => a + b, 0), 0x0a, 0x0d];
}

/** One serial receiver for one polarity, fed a clean high/low line a sample at a time. */
class Uart {
  private prev: 0 | 1;
  /** Samples since the start bit's edge, or -1 while waiting for one. */
  private pos = -1;
  private bit = 0;
  private byte = 0;
  private bytes: number[] = [];

  constructor(
    private readonly mark: 0 | 1,
    private readonly bitLen: number,
    private readonly onPacket: (p: StackmatPacket) => void,
  ) {
    this.prev = mark;
  }

  push(level: 0 | 1) {
    const prev = this.prev;
    this.prev = level;
    if (this.pos < 0) {
      // Idle (mark) until a start bit pulls the line the other way.
      if (prev === this.mark && level !== this.mark) {
        this.pos = 0;
        this.bit = 0;
        this.byte = 0;
      }
      return;
    }
    this.pos++;
    // Read each bit in its middle: start bit at 0.5, data at 1.5 to 8.5, stop at 9.5.
    if (this.pos < (this.bit + 0.5) * this.bitLen) return;
    const isMark = level === this.mark;
    if (this.bit === 0) {
      if (isMark) this.pos = -1; // A glitch, not a start bit.
      else this.bit++;
      return;
    }
    if (this.bit <= 8) {
      if (isMark) this.byte |= 1 << (this.bit - 1);
      this.bit++;
      return;
    }
    this.pos = -1;
    if (!isMark) {
      // Framing error: we're out of step. Start the packet over.
      this.bytes = [];
      return;
    }
    this.receive(this.byte);
  }

  private receive(byte: number) {
    const bytes = this.bytes;
    bytes.push(byte);
    if (bytes.length > 10) bytes.shift();
    const n = bytes.length;
    if (n < 9 || bytes[n - 2] !== 0x0a || bytes[n - 1] !== 0x0d) return;
    const packet = parsePacket(bytes.slice(n - 10)) ?? parsePacket(bytes.slice(n - 9));
    this.bytes = [];
    if (packet) this.onPacket(packet);
  }
}

export class StackmatDecoder {
  private readonly uarts: Uart[];
  private level: 0 | 1 = 1;
  /** The last few samples, to measure how fast the signal is changing. */
  private readonly history: Float32Array;
  private at = 0;
  private envelope = 0;
  private readonly decay: number;

  constructor(sampleRate: number, onPacket: (p: StackmatPacket) => void) {
    const bitLen = sampleRate / BAUD;
    this.uarts = [new Uart(1, bitLen, onPacket), new Uart(0, bitLen, onPacket)];
    this.history = new Float32Array(Math.max(2, Math.round(bitLen / 4)));
    // The edge-size estimate halves in about a quarter of a second.
    this.decay = Math.pow(0.5, 1 / (sampleRate * 0.25));
  }

  push(samples: Float32Array | number[]) {
    const h = this.history;
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i];
      // Look for edges rather than levels: mic inputs are AC coupled, so a
      // steady level sags toward zero, but a bit flip is always a sharp jump.
      const d = x - h[this.at];
      h[this.at] = x;
      this.at = (this.at + 1) % h.length;
      const a = Math.abs(d);
      this.envelope = a > this.envelope ? a : this.envelope * this.decay;
      // Below this it's just noise.
      if (this.envelope < 0.01) continue;
      const threshold = this.envelope * 0.4;
      if (d > threshold) this.level = 1;
      else if (d < -threshold) this.level = 0;
      for (const u of this.uarts) u.push(this.level);
    }
  }
}
