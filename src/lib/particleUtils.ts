/**
 * Core math + data model for the voxel face visualizer.
 *
 * The whole particle field lives inside a fixed-width world box so that the
 * camera never needs to move when the particle count changes: denser grids
 * simply mean smaller cells (and smaller cubes) filling the same area.
 */

export const WORLD_WIDTH = 100;

/** Config driven by the Leva GUI (see components/Controls.tsx). */
export interface VizConfig {
  columns: number;
  cubeSize: number;
  spacing: number;
  depthStrength: number;
  brightness: number;
  noiseIntensity: number;
  noiseSpeed: number;
  animationSpeed: number;
  mouseForce: number;
  mouseRadius: number;
  swirl: number;
  returnSpeed: number;
  colorMode: number;
  bloomIntensity: number;
  autoRotate: boolean;
  faceDetect: boolean;
  audioReactive: boolean;
}

export const DEFAULT_CONFIG: VizConfig = {
  columns: 220,
  cubeSize: 0.90,
  spacing: 1.60,
  depthStrength: 26,
  brightness: 1.1,
  noiseIntensity: 0.9,
  noiseSpeed: 0.5,
  animationSpeed: 1,
  mouseForce: 26,
  mouseRadius: 16,
  swirl: 20,
  returnSpeed: 0.9,
  colorMode: 2,
  bloomIntensity: 1.1,
  autoRotate: false,
  faceDetect: false,
  audioReactive: false,
};

/** A facial landmark, in mirrored grid-normalized coordinates (0..1). */
export interface FaceLandmark {
  u: number;
  v: number;
}

/**
 * Mutable, ref-held state shared between the DOM overlay (keyboard, mouse,
 * audio, face detection) and the render loop. Deliberately NOT React state so
 * that mutating it never triggers a re-render of the heavy particle field.
 */
export interface EngineState {
  paused: boolean;
  reassemble: boolean;
  explode: boolean;
  mouseX: number;
  mouseY: number;
  mouseActive: boolean;
  mouseMoveT: number;
  audioLevel: number;
  landmarks: FaceLandmark[];
}

export function createEngine(): EngineState {
  return {
    paused: false,
    reassemble: false,
    explode: false,
    mouseX: 0,
    mouseY: 0,
    mouseActive: false,
    mouseMoveT: 0,
    audioLevel: 0,
    landmarks: [],
  };
}

export interface GridDims {
  cols: number;
  rows: number;
  count: number;
}

/** Derive a grid from a column count using a 4:3 sampling aspect. */
export function gridDims(columns: number, aspect = 4 / 3): GridDims {
  const cols = Math.max(8, Math.round(columns));
  const rows = Math.max(6, Math.round(cols / aspect));
  return { cols, rows, count: cols * rows };
}

/** Perceptual luminance for 0..1 rgb inputs. */
export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Extra emissive push per color mode so bright cubes bloom in their own hue. */
export const EMISSIVE_BY_MODE = [0.12, 0.45, 0.55, 0.4, 0.18];

function hueToChannel(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

export function hslToRgb(
  h: number,
  s: number,
  l: number,
  out: [number, number, number],
): [number, number, number] {
  if (s === 0) {
    out[0] = out[1] = out[2] = l;
    return out;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  out[0] = hueToChannel(p, q, h + 1 / 3);
  out[1] = hueToChannel(p, q, h);
  out[2] = hueToChannel(p, q, h - 1 / 3);
  return out;
}

/**
 * Resolve the color for a single voxel.
 * @param mode  0 webcam · 1 white · 2 neon blue · 3 rainbow · 4 wireframe(original)
 * @param u     horizontal position across the grid (0..1)
 */
export function computeColor(
  mode: number,
  r: number,
  g: number,
  b: number,
  bright: number,
  u: number,
  time: number,
  out: [number, number, number],
): [number, number, number] {
  switch (mode) {
    case 1: {
      // White cubes shaded by brightness.
      const v = 0.2 + 0.9 * bright;
      out[0] = v;
      out[1] = v;
      out[2] = v;
      return out;
    }
    case 2: {
      // Neon blue with cyan highlights on bright pixels.
      out[0] = 0.08 * bright;
      out[1] = 0.3 * bright + 0.15;
      out[2] = 0.55 + 0.45 * bright;
      return out;
    }
    case 3: {
      // Rainbow gradient across the width, drifting slowly over time.
      const h = (u + time * 0.03) % 1;
      const l = 0.25 + 0.5 * bright;
      return hslToRgb(h, 0.85, l, out);
    }
    case 0:
    case 4:
    default: {
      // Original webcam color (mode 4 renders these as wireframe).
      out[0] = Math.min(1, r * 1.1);
      out[1] = Math.min(1, g * 1.1);
      out[2] = Math.min(1, b * 1.1);
      return out;
    }
  }
}
