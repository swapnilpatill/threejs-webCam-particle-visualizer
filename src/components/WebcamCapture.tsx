"use client";

import type { WebcamStatus } from "@/hooks/useWebcam";

interface Props {
  status: WebcamStatus;
  paused: boolean;
  colorMode: number;
  onStart: () => void;
  onDemo: () => void;
  onStop: () => void;
}

const COLOR_MODE_LABELS = ["Webcam", "White", "Neon Blue", "Rainbow", "Wireframe"];

const KEY_HINTS: [string, string][] = [
  ["Space", "pause"],
  ["R", "reassemble"],
  ["E", "explode"],
  ["C", "color mode"],
];

/**
 * The DOM overlay: permission flow (hero), the active top bar, status pill and
 * keyboard hints. Container is pointer-events-none so orbit/mouse-force still
 * work through it; only the interactive controls opt back in.
 */
export default function WebcamCapture({
  status,
  paused,
  colorMode,
  onStart,
  onDemo,
  onStop,
}: Props) {
  const active = status === "live" || status === "demo";

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* Top bar */}
      <div className="flex items-start justify-between p-5 sm:p-8">
        <div>
          <h1 className="text-lg font-semibold tracking-[0.2em] text-white/90 sm:text-xl">
           SCHBANG
          </h1>
           
        </div>

        {active && (
          <div className="pointer-events-auto flex items-center gap-3">
            <StatusPill status={status} paused={paused} colorMode={colorMode} />
            <button
              onClick={onStop}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur-md transition hover:border-white/30 hover:bg-white/10"
            >
              Stop
            </button>
          </div>
        )}
      </div>

      {/* Hero / permission flow */}
      {!active && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <div className="pointer-events-auto max-w-md">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-[2px] bg-sky-400"
                    style={{ opacity: 0.35 + ((i * 37) % 6) * 0.11 }}
                  />
                ))}
              </div>
            </div>

            <h2 className="text-2xl font-semibold text-white sm:text-3xl">
              Become a voxel portrait
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/50">
              Enable your camera and watch thousands of tiny cubes assemble into
              a live 3D likeness — reacting to your movement, light and depth.
            </p>

            {status === "denied" && (
              <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
                Camera access was blocked. You can still explore everything in
                Demo Mode.
              </p>
            )}

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={onStart}
                className="w-full rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400 sm:w-auto"
              >
                {status === "requesting" ? "Requesting…" : "Enable Camera"}
              </button>
              <button
                onClick={onDemo}
                className="w-full rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white/80 backdrop-blur-md transition hover:border-white/30 hover:bg-white/10 sm:w-auto"
              >
                Demo Mode
              </button>
            </div>

            <p className="mt-5 text-[11px] text-white/30">
              Video never leaves your device — all processing is local.
            </p>
          </div>
        </div>
      )}

      {/* Keyboard hints */}
      {active && (
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 sm:bottom-8">
          {KEY_HINTS.map(([key, label]) => (
            <div
              key={key}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 backdrop-blur-md"
            >
              <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">
                {key}
              </kbd>
              <span className="text-[11px] text-white/40">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({
  status,
  paused,
  colorMode,
}: {
  status: WebcamStatus;
  paused: boolean;
  colorMode: number;
}) {
  const dot = paused
    ? "bg-amber-400"
    : status === "demo"
      ? "bg-fuchsia-400"
      : "bg-emerald-400";
  const label = paused
    ? "Paused"
    : status === "demo"
      ? "Demo"
      : "Live";
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs backdrop-blur-md">
      <span className={`h-2 w-2 rounded-full ${dot} ${paused ? "" : "animate-pulse"}`} />
      <span className="font-medium text-white/80">{label}</span>
      <span className="text-white/30">·</span>
      <span className="text-white/50">{COLOR_MODE_LABELS[colorMode] ?? "Webcam"}</span>
    </div>
  );
}
