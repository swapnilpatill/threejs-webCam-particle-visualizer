"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Leva } from "leva";
import { useVizControls } from "./Controls";
import WebcamCapture from "./WebcamCapture";
import { useWebcam } from "@/hooks/useWebcam";
import { useAudio } from "@/hooks/useAudio";
import { useFaceMesh } from "@/hooks/useFaceMesh";
import { createEngine } from "@/lib/particleUtils";

// The WebGL scene touches browser-only APIs (WebGL, canvas, window) so it must
// be client-only — never server-rendered.
const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => <Splash />,
});

function Splash() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050505]">
      <div className="flex items-center gap-3 text-white/50">
        <span className="h-2.5 w-2.5 animate-ping rounded-sm bg-sky-400" />
        <span className="text-sm tracking-wide">Initializing renderer…</span>
      </div>
    </div>
  );
}

/**
 * Top-level client orchestrator. Owns the shared engine ref, the Leva config,
 * the webcam/audio/face hooks, and the global keyboard shortcuts. Renders the
 * WebGL scene (client-only) beneath the DOM overlay.
 */
export default function Experience() {
  const engineRef = useRef(createEngine());
  const engine = engineRef.current;

  const [config, set] = useVizControls(engine);
  const webcam = useWebcam();
  const sourceReady = webcam.status === "live" || webcam.status === "demo";

  useAudio(config.audioReactive, engine);
  useFaceMesh(config.faceDetect, webcam.sourceRef, engine);

  const [paused, setPaused] = useState(false);

  // Keep the latest color mode available to the keydown handler without
  // re-binding the listener on every change.
  const colorRef = useRef(config.colorMode);
  colorRef.current = config.colorMode;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore shortcuts while typing in the Leva panel.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.isContentEditable)) {
        return;
      }
      switch (e.code) {
        case "Space":
          e.preventDefault();
          engine.paused = !engine.paused;
          setPaused(engine.paused);
          break;
        case "KeyR":
          engine.reassemble = true;
          break;
        case "KeyE":
          engine.explode = true;
          break;
        case "KeyC":
          set({ colorMode: (Number(colorRef.current) + 1) % 5 });
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, set]);

  return (
    <div className="fixed inset-0 bg-[#050505]">
      <Leva collapsed />
      <Scene
        config={config}
        engine={engine}
        sourceRef={webcam.sourceRef}
        sourceReady={sourceReady}
      />
      <WebcamCapture
        status={webcam.status}
        paused={paused}
        colorMode={config.colorMode}
        onStart={webcam.start}
        onDemo={webcam.startDemo}
        onStop={webcam.stop}
      />
    </div>
  );
}
