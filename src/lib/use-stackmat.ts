"use client";

import { useEffect, useRef, useState } from "react";
import { StackmatDecoder, type StackmatPacket } from "./stackmat";

export type StackmatConnection =
  /** Asking for the microphone. */
  | "starting"
  /** Listening, but no packets: the timer is off or not plugged in. */
  | "no-signal"
  | "connected"
  /** The browser refused the microphone. */
  | "blocked"
  | "error";

// Packets come about ten times a second; this long without one means the timer is gone.
const SIGNAL_TIMEOUT_MS = 600;

// Hands audio to the page in blocks, rather than 128 samples at a time.
const WORKLET = `
class StackmatTap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(2048); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === this.buf.length) { this.port.postMessage(this.buf); this.buf = new Float32Array(2048); this.n = 0; }
    }
    return true;
  }
}
registerProcessor("stackmat-tap", StackmatTap);
`;

/**
 * Listen to a Stackmat on an audio input. `onPacket` gets every packet, with
 * the time it arrived (performance.now()). Pass enabled false to stop and
 * release the microphone.
 */
export function useStackmat(enabled: boolean, deviceId: string | undefined, onPacket: (p: StackmatPacket, at: number) => void) {
  const [connection, setConnection] = useState<StackmatConnection>("starting");
  const onPacketRef = useRef(onPacket);
  useEffect(() => {
    onPacketRef.current = onPacket;
  });

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let ctx: AudioContext | undefined;
    let listening = false;
    let lastPacket = 0;
    setConnection("starting");

    const watchdog = window.setInterval(() => {
      if (stopped || !listening) return;
      setConnection(performance.now() - lastPacket < SIGNAL_TIMEOUT_MS ? "connected" : "no-signal");
    }, 250);

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            // Anything that "improves" speech garbles the data signal.
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
          },
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        ctx = new AudioContext();
        const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
        await ctx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        if (stopped) return;
        const decoder = new StackmatDecoder(ctx.sampleRate, (p) => {
          lastPacket = performance.now();
          onPacketRef.current(p, lastPacket);
        });
        const tap = new AudioWorkletNode(ctx, "stackmat-tap");
        tap.port.onmessage = (e: MessageEvent<Float32Array>) => decoder.push(e.data);
        ctx.createMediaStreamSource(stream).connect(tap);
        // Some browsers only run a worklet that leads somewhere; it outputs silence.
        tap.connect(ctx.destination);
        // Without a click or key press first, the browser may hold audio back.
        if (ctx.state === "suspended") {
          const resume = () => ctx?.resume();
          window.addEventListener("pointerdown", resume, { once: true });
          window.addEventListener("keydown", resume, { once: true });
          ctx.resume();
        }
        listening = true;
        setConnection("no-signal");
      } catch (e) {
        if (stopped) return;
        setConnection(e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "blocked" : "error");
      }
    })();

    return () => {
      stopped = true;
      window.clearInterval(watchdog);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close();
    };
  }, [enabled, deviceId]);

  return connection;
}

export type AudioInput = { id: string; label: string };

/** Audio inputs to pick the Stackmat from. Labels only show once the microphone is allowed. */
export function useAudioInputs(refreshKey: unknown): AudioInput[] {
  const [inputs, setInputs] = useState<AudioInput[]>([]);
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    let live = true;
    const load = () =>
      navigator.mediaDevices.enumerateDevices().then((all) => {
        if (!live) return;
        const audio = all.filter((d) => d.kind === "audioinput" && d.deviceId);
        setInputs(audio.map((d, i) => ({ id: d.deviceId, label: d.label || `Input ${i + 1}` })));
      });
    load();
    navigator.mediaDevices.addEventListener("devicechange", load);
    return () => {
      live = false;
      navigator.mediaDevices.removeEventListener("devicechange", load);
    };
  }, [refreshKey]);
  return inputs;
}
