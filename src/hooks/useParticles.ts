"use client";

import { useMemo } from "react";
import { gridDims, WORLD_WIDTH } from "@/lib/particleUtils";

/** Per-instance buffers holding dynamic (per-frame) state. */
export interface ParticleBuffers {
  dispX: Float32Array;
  dispY: Float32Array;
  dispZ: Float32Array;
  bSmooth: Float32Array;
  cr: Float32Array;
  cg: Float32Array;
  cb: Float32Array;
}

export interface ParticleData {
  cols: number;
  rows: number;
  count: number;
  base: { x: Float32Array; y: Float32Array };
  buffers: ParticleBuffers;
}

/**
 * Builds the memoized grid layout and per-instance buffers for the voxel field.
 * Base positions recompute when the grid shape or spacing changes; the dynamic
 * buffers reallocate only when the total count changes (which forces the
 * InstancedMesh to rebuild).
 */
export function useParticles(columns: number, spacing: number): ParticleData {
  const { cols, rows, count } = useMemo(() => gridDims(columns), [columns]);

  const base = useMemo(() => {
    const x = new Float32Array(count);
    const y = new Float32Array(count);
    const cell = WORLD_WIDTH / cols;
    const cCol = (cols - 1) / 2;
    const cRow = (rows - 1) / 2;
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = (i / cols) | 0;
      x[i] = (col - cCol) * cell * spacing;
      y[i] = (cRow - row) * cell * spacing;
    }
    return { x, y };
  }, [cols, rows, count, spacing]);

  const buffers = useMemo<ParticleBuffers>(
    () => ({
      dispX: new Float32Array(count),
      dispY: new Float32Array(count),
      dispZ: new Float32Array(count),
      bSmooth: new Float32Array(count),
      cr: new Float32Array(count),
      cg: new Float32Array(count),
      cb: new Float32Array(count),
    }),
    [count],
  );

  return { cols, rows, count, base, buffers };
}
