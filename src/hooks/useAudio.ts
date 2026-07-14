"use client";

import { useEffect } from "react";
import type { EngineState } from "@/lib/particleUtils";

/**
 * Optional microphone-reactivity. When enabled, requests mic access and writes
 * a smoothed 0..1 amplitude into `engine.audioLevel`, which the renderer uses
 * to gently pulse voxel scale. Fully self-cleaning and fails gracefully.
 */
export function useAudio(enabled: boolean, engine: EngineState) {
  useEffect(() => {
    if (!enabled) return;

    let raf = 0;
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) return;
        ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const loop = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const level = sum / data.length / 255;
          // Smooth to avoid jitter.
          engine.audioLevel += (level - engine.audioLevel) * 0.2;
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch (err) {
        console.warn("Microphone unavailable:", err);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
      engine.audioLevel = 0;
    };
  }, [enabled, engine]);
}
