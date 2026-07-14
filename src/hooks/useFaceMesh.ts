"use client";

import { useEffect } from "react";
import type { EngineState, FaceLandmark } from "@/lib/particleUtils";
import type { PixelSource } from "@/lib/webcamUtils";

// MediaPipe assets are fetched from a CDN on first enable. Kept out of the
// initial bundle via a dynamic import, and behind a toggle (default off).
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// A handful of landmark indices for eyes, nose and mouth (468-point FaceMesh).
const KEY_INDICES = [33, 133, 159, 145, 362, 263, 386, 374, 1, 13, 14, 61, 291];

/**
 * Optional MediaPipe FaceLandmarker integration. Detects the face in the live
 * source and publishes mirrored, grid-normalized landmark positions to
 * `engine.landmarks`, which the renderer uses to pulse nearby voxels. Loads
 * lazily and degrades gracefully — any failure just leaves landmarks empty.
 */
export function useFaceMesh(
  enabled: boolean,
  sourceRef: React.RefObject<PixelSource | null>,
  engine: EngineState,
) {
  useEffect(() => {
    if (!enabled) return;

    let raf = 0;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let landmarker: any = null;

    (async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const { FaceLandmarker, FilesetResolver } = vision;
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
        if (cancelled) return;
        landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
        });
        if (cancelled) {
          landmarker?.close?.();
          return;
        }

        const loop = () => {
          if (cancelled) return;
          const src = sourceRef.current;
          const ready =
            src &&
            (src instanceof HTMLVideoElement ? src.readyState >= 2 : true);
          if (ready) {
            try {
              const res = landmarker.detectForVideo(src, performance.now());
              const lm = res?.faceLandmarks?.[0];
              if (lm) {
                engine.landmarks = KEY_INDICES.map(
                  (idx): FaceLandmark => ({ u: 1 - lm[idx].x, v: lm[idx].y }),
                );
              } else {
                engine.landmarks = [];
              }
            } catch {
              // Ignore transient per-frame detection errors.
            }
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch (err) {
        console.warn("Face detection unavailable:", err);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      landmarker?.close?.();
      engine.landmarks = [];
    };
  }, [enabled, sourceRef, engine]);
}
