"use client";

import { button, folder, useControls } from "leva";
import { DEFAULT_CONFIG, type EngineState, type VizConfig } from "@/lib/particleUtils";

/**
 * Defines the Leva GUI and returns the live config plus a setter (used by the
 * "C" keyboard shortcut to cycle color modes). Folders keep the panel tidy but
 * the returned object is flat: `config.columns`, `config.bloomIntensity`, etc.
 */
export function useVizControls(engine: EngineState): [VizConfig, (v: Partial<VizConfig>) => void] {
  const [values, set] = useControls(() => ({
    Voxels: folder({
      columns: { value: DEFAULT_CONFIG.columns, min: 48, max: 220, step: 4 },
      cubeSize: { value: DEFAULT_CONFIG.cubeSize, min: 0.1, max: 1.6, step: 0.01 },
      spacing: { value: DEFAULT_CONFIG.spacing, min: 0.5, max: 1.6, step: 0.01 },
      depthStrength: { value: DEFAULT_CONFIG.depthStrength, min: 0, max: 70, step: 1 },
      brightness: { value: DEFAULT_CONFIG.brightness, min: 0.4, max: 2, step: 0.05 },
    }),
    Motion: folder({
      noiseIntensity: { value: DEFAULT_CONFIG.noiseIntensity, min: 0, max: 5, step: 0.1 },
      noiseSpeed: { value: DEFAULT_CONFIG.noiseSpeed, min: 0, max: 2, step: 0.05 },
      animationSpeed: { value: DEFAULT_CONFIG.animationSpeed, min: 0.1, max: 3, step: 0.1 },
    }),
    Mouse: folder({
      mouseForce: { value: DEFAULT_CONFIG.mouseForce, min: 0, max: 80, step: 1 },
      mouseRadius: { value: DEFAULT_CONFIG.mouseRadius, min: 2, max: 50, step: 1 },
      swirl: { value: DEFAULT_CONFIG.swirl, min: 0, max: 40, step: 1 },
      returnSpeed: { value: DEFAULT_CONFIG.returnSpeed, min: 0.75, max: 0.98, step: 0.005 },
    }),
    Look: folder({
      colorMode: {
        value: DEFAULT_CONFIG.colorMode,
        options: { Webcam: 0, White: 1, "Neon Blue": 2, Rainbow: 3, Wireframe: 4 },
      },
      bloomIntensity: { value: DEFAULT_CONFIG.bloomIntensity, min: 0, max: 3, step: 0.05 },
      autoRotate: { value: DEFAULT_CONFIG.autoRotate },
    }),
    Extras: folder(
      {
        faceDetect: { value: DEFAULT_CONFIG.faceDetect, label: "face pulse" },
        audioReactive: { value: DEFAULT_CONFIG.audioReactive, label: "mic reactive" },
      },
      { collapsed: true },
    ),
    Actions: folder({
      Reassemble: button(() => {
        engine.reassemble = true;
      }),
      Explode: button(() => {
        engine.explode = true;
      }),
    }),
  }));

  return [
    values as unknown as VizConfig,
    set as unknown as (v: Partial<VizConfig>) => void,
  ];
}
