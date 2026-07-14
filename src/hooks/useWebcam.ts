"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDemoSource,
  createVideoElement,
  requestCamera,
  type PixelSource,
} from "@/lib/webcamUtils";

export type WebcamStatus =
  | "idle"
  | "requesting"
  | "live"
  | "demo"
  | "denied"
  | "stopped";

/**
 * Manages the pixel source lifecycle (real webcam or synthetic demo) and
 * exposes it as a stable ref so the render loop can sample it every frame
 * without re-rendering.
 */
export function useWebcam() {
  const [status, setStatus] = useState<WebcamStatus>("idle");
  const sourceRef = useRef<PixelSource | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const demoStopRef = useRef<(() => void) | null>(null);

  const teardown = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    demoStopRef.current?.();
    demoStopRef.current = null;
    sourceRef.current = null;
  }, []);

  const start = useCallback(async () => {
    teardown();
    setStatus("requesting");
    try {
      const stream = await requestCamera();
      streamRef.current = stream;
      const video = await createVideoElement(stream);
      sourceRef.current = video;
      setStatus("live");
    } catch (err) {
      console.warn("Camera unavailable:", err);
      setStatus("denied");
    }
  }, [teardown]);

  const startDemo = useCallback(() => {
    teardown();
    const { canvas, stop } = createDemoSource();
    demoStopRef.current = stop;
    sourceRef.current = canvas;
    setStatus("demo");
  }, [teardown]);

  const stop = useCallback(() => {
    teardown();
    setStatus("stopped");
  }, [teardown]);

  useEffect(() => () => teardown(), [teardown]);

  return { status, sourceRef, start, startDemo, stop };
}
