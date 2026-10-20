import { describe, expect, test } from "bun:test";
import { StackmatDecoder, encodePacket, parsePacket, type StackmatPacket } from "./stackmat";

/** A packet stream as a sound card would record it: serial bits, AC coupled, with noise. */
function signal(packets: number[][], { rate = 44100, invert = false, gapBits = 15, noise = 0.02, amp = 0.6 } = {}) {
  const bitLen = rate / 1200;
  const bits: number[] = [];
  const idle = (n: number) => bits.push(...Array(n).fill(1));
  idle(40);
  for (const p of packets) {
    for (const byte of p) {
      bits.push(0);
      for (let i = 0; i < 8; i++) bits.push((byte >> i) & 1);
      bits.push(1);
    }
    idle(gapBits);
  }
  idle(40);
  const out = new Float32Array(Math.ceil(bits.length * bitLen));
  // One-pole high-pass at 20 Hz, like the capacitor on a mic input.
  const rc = 1 / (2 * Math.PI * 20);
  const alpha = rc / (rc + 1 / rate);
  let prevIn = 0;
  let prevOut = 0;
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < out.length; i++) {
    const bit = bits[Math.floor(i / bitLen)];
    const x = (bit ^ (invert ? 1 : 0) ? amp : -amp);
    prevOut = alpha * (prevOut + x - prevIn);
    prevIn = x;
    out[i] = prevOut + noise * rand();
  }
  return out;
}

function decode(samples: Float32Array, rate = 44100) {
  const got: StackmatPacket[] = [];
  const d = new StackmatDecoder(rate, (p) => got.push(p));
  // Feed it in chunks like an audio worklet does.
  for (let i = 0; i < samples.length; i += 1024) d.push(samples.subarray(i, i + 1024));
  return got;
}

describe("parsePacket", () => {
  test("gen 3 (thousandths) and gen 2 (hundredths)", () => {
    expect(parsePacket(encodePacket(" ", 83456))).toEqual({ status: " ", ms: 83456 });
    expect(parsePacket(encodePacket("S", 9870, 5))).toEqual({ status: "S", ms: 9870 });
  });

  test("rejects a bad checksum or status", () => {
    const bytes = encodePacket("S", 12345);
    bytes[7]++;
    expect(parsePacket(bytes)).toBeNull();
    expect(parsePacket(encodePacket("S", 12345).map((b, i) => (i === 0 ? 0x5a : b)))).toBeNull();
  });
});

describe("StackmatDecoder", () => {
  const packets = [encodePacket("I", 0), encodePacket("C", 0), encodePacket("A", 0), encodePacket(" ", 120), encodePacket(" ", 230), encodePacket("S", 11234)];
  const expected: StackmatPacket[] = [
    { status: "I", ms: 0 },
    { status: "C", ms: 0 },
    { status: "A", ms: 0 },
    { status: " ", ms: 120 },
    { status: " ", ms: 230 },
    { status: "S", ms: 11234 },
  ];

  for (const invert of [false, true]) {
    for (const rate of [44100, 48000]) {
      test(`${invert ? "inverted" : "upright"} at ${rate} Hz`, () => {
        expect(decode(signal(packets, { rate, invert }), rate)).toEqual(expected);
      });
    }
  }

  test("back to back packets with no gap", () => {
    expect(decode(signal(packets, { gapBits: 0 }))).toEqual(expected);
  });

  test("gen 2 packets", () => {
    expect(decode(signal([encodePacket("S", 9870, 5)]))).toEqual([{ status: "S", ms: 9870 }]);
  });

  test("a quiet, noisy line", () => {
    expect(decode(signal(packets, { amp: 0.05, noise: 0.008 }))).toEqual(expected);
  });

  test("silence and noise give nothing", () => {
    const noise = new Float32Array(44100).map((_, i) => Math.sin(i * 12.9898) * 0.003);
    expect(decode(noise)).toEqual([]);
  });
});
