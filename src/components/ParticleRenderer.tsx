"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";
import { useParticles } from "@/hooks/useParticles";
import { makeVoxelMaterial } from "@/shaders/instancedEmissive";
import {
  computeColor,
  EMISSIVE_BY_MODE,
  luminance,
  WORLD_WIDTH,
  type EngineState,
  type VizConfig,
} from "@/lib/particleUtils";
import type { PixelSource } from "@/lib/webcamUtils";

interface Props {
  config: VizConfig;
  engine: EngineState;
  sourceRef: React.RefObject<PixelSource | null>;
  sourceReady: boolean;
}

/**
 * The heart of the visualizer: a single InstancedMesh whose per-instance
 * matrices and colors are recomputed every frame from the sampled video. All
 * heavy work happens inside useFrame by mutating typed arrays directly — no
 * React re-renders, no per-cube components.
 */
export default function ParticleRenderer({
  config,
  engine,
  sourceRef,
  sourceReady,
}: Props) {
  const { camera } = useThree();
  const { cols, rows, count, base, buffers } = useParticles(
    config.columns,
    config.spacing,
  );
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Shared geometry + material (created once; disposed on unmount). `dispose`
  // is disabled on the mesh so rebuilding it on count change never disposes
  // these shared objects.
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const { mat, uniforms } = useMemo(() => makeVoxelMaterial(), []);
  useEffect(
    () => () => {
      geometry.dispose();
      mat.dispose();
    },
    [geometry, mat],
  );

  // Offscreen canvas used to downscale the source to grid resolution and read
  // its pixels each frame.
  const sampler = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = cols;
    c.height = rows;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    return { ctx };
  }, [cols, rows]);

  // Reusable scratch objects (never allocated inside the loop).
  const noise = useMemo(() => createNoise3D(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const mouseWorld = useMemo(() => new THREE.Vector3(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const rgb = useMemo<[number, number, number]>(() => [0, 0, 0], []);

  // Persistent animation state (survives count-driven mesh rebuilds).
  const anim = useRef({
    time: 0,
    vis: 0,
    visTarget: 1,
    exploding: false,
    prevReady: false,
    lastData: null as Uint8ClampedArray | null,
  });

  // Scatter every voxel onto a random sphere shell (used for assemble/reassemble).
  const scatter = useMemo(
    () => () => {
      const { dispX, dispY, dispZ } = buffers;
      for (let i = 0; i < count; i++) {
        const r = 60 + Math.random() * 120;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        dispX[i] = Math.sin(ph) * Math.cos(th) * r;
        dispY[i] = Math.sin(ph) * Math.sin(th) * r;
        dispZ[i] = Math.cos(ph) * r;
      }
    },
    [buffers, count],
  );

  // On (re)build, scatter and reset smoothing so the field assembles in.
  useEffect(() => {
    scatter();
    const a = anim.current;
    a.vis = 0;
    a.visTarget = 1;
    a.exploding = false;
    buffers.bSmooth.fill(0);
    buffers.cr.fill(0);
    buffers.cg.fill(0);
    buffers.cb.fill(0);
  }, [count, scatter, buffers]);

  // React to the source turning on (assemble) or off (explode + dissolve).
  useEffect(() => {
    const a = anim.current;
    if (sourceReady && !a.prevReady) {
      scatter();
      a.vis = 0;
      a.visTarget = 1;
      a.exploding = false;
    } else if (!sourceReady && a.prevReady) {
      engine.explode = true;
    }
    a.prevReady = sourceReady;
  }, [sourceReady, scatter, engine]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const a = anim.current;
    if (engine.paused) return;

    const dt = Math.min(delta, 0.05);
    const { dispX, dispY, dispZ, bSmooth, cr, cg, cb } = buffers;

    // --- One-shot requests (keyboard / GUI / lifecycle) ---
    if (engine.reassemble) {
      engine.reassemble = false;
      scatter();
      a.vis = 0;
      a.visTarget = 1;
      a.exploding = false;
    }
    if (engine.explode) {
      engine.explode = false;
      a.exploding = true;
      a.visTarget = 0;
      for (let i = 0; i < count; i++) {
        const bx = base.x[i];
        const by = base.y[i];
        const len = Math.hypot(bx, by) || 1;
        const s = 1.5 + Math.random() * 2;
        dispX[i] += (bx / len) * s * 8 + (Math.random() - 0.5) * 6;
        dispY[i] += (by / len) * s * 8 + (Math.random() - 0.5) * 6;
        dispZ[i] += (Math.random() - 0.5) * 30 + 10;
      }
    }

    a.time += dt * config.animationSpeed;
    const t = a.time;
    a.vis += (a.visTarget - a.vis) * Math.min(1, dt * 3);

    // --- Sample the pixel source (keep last frame if unavailable) ---
    let data = a.lastData;
    const src = sourceRef.current;
    if (src) {
      const sw = src instanceof HTMLVideoElement ? src.videoWidth : src.width;
      const sh = src instanceof HTMLVideoElement ? src.videoHeight : src.height;
      if (sw > 0 && sh > 0) {
        try {
          sampler.ctx.drawImage(src as CanvasImageSource, 0, 0, cols, rows);
          data = sampler.ctx.getImageData(0, 0, cols, rows).data;
          a.lastData = data;
        } catch {
          // Source not decode-ready yet.
        }
      }
    }
    const dormant = !sourceReady && !data;

    // --- Mouse force field (only while the pointer is actively moving) ---
    let mouseOn = false;
    if (
      engine.mouseActive &&
      performance.now() - engine.mouseMoveT < 180
    ) {
      ndc.set(engine.mouseX, engine.mouseY);
      raycaster.setFromCamera(ndc, camera);
      mouseOn = raycaster.ray.intersectPlane(plane, mouseWorld) !== null;
    }

    // --- Per-frame constants ---
    const decay = a.exploding
      ? 1.035
      : Math.pow(config.returnSpeed, dt * 60);
    const cell = WORLD_WIDTH / cols;
    const freq = 0.045;
    const amp = config.noiseIntensity;
    const nt = t * config.noiseSpeed;
    const mode = Number(config.colorMode);
    const audioPulse = config.audioReactive ? 1 + engine.audioLevel * 0.8 : 1;
    const lms =
      config.faceDetect && engine.landmarks.length ? engine.landmarks : null;
    const faceR2 = 0.0016; // (~0.04 grid units)^2

    uniforms.uEmissive.value = EMISSIVE_BY_MODE[mode] ?? 0.2;
    mat.wireframe = mode === 4;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = (i / cols) | 0;
      const bx = base.x[i];
      const by = base.y[i];

      // Brightness + color from the mirrored pixel.
      let pr = 0.05;
      let pg = 0.12;
      let pb = 0.28;
      let br = 0.12;
      if (data) {
        const idx = (row * cols + (cols - 1 - col)) * 4;
        pr = data[idx] / 255;
        pg = data[idx + 1] / 255;
        pb = data[idx + 2] / 255;
        br = luminance(pr, pg, pb) * config.brightness;
      } else if (dormant) {
        br = 0.12 + 0.08 * (0.5 + 0.5 * noise(col * 0.15, row * 0.15, t * 0.3));
      }
      br = br < 0 ? 0 : br > 1 ? 1 : br;

      bSmooth[i] += (br - bSmooth[i]) * 0.28;
      const b = bSmooth[i];

      if (dormant) {
        rgb[0] = 0.06;
        rgb[1] = 0.12;
        rgb[2] = 0.3;
      } else {
        computeColor(mode, pr, pg, pb, b, col / cols, t, rgb);
      }
      cr[i] += (rgb[0] - cr[i]) * 0.3;
      cg[i] += (rgb[1] - cg[i]) * 0.3;
      cb[i] += (rgb[2] - cb[i]) * 0.3;

      // Displacement decays back toward the base (or expands when exploding).
      dispX[i] *= decay;
      dispY[i] *= decay;
      dispZ[i] *= decay;

      // Mouse repel + swirl impulse.
      if (mouseOn) {
        const px = bx + dispX[i];
        const py = by + dispY[i];
        const dx = px - mouseWorld.x;
        const dy = py - mouseWorld.y;
        const dist = Math.hypot(dx, dy);
        if (dist < config.mouseRadius) {
          const f = 1 - dist / config.mouseRadius;
          const inv = 1 / (dist || 0.001);
          const nx = dx * inv;
          const ny = dy * inv;
          const push = f * config.mouseForce * dt * 6;
          const twist = f * config.swirl * dt * 6;
          dispX[i] += nx * push - ny * twist;
          dispY[i] += ny * push + nx * twist;
          dispZ[i] += f * config.mouseForce * dt * 3;
        }
      }

      // Idle simplex float.
      const nx = noise(bx * freq, by * freq, nt) * amp;
      const ny = noise(bx * freq + 40, by * freq, nt) * amp;
      const nz = noise(bx * freq, by * freq + 40, nt) * amp * 0.7;

      // Facial-landmark pulse.
      let fp = 1;
      if (lms) {
        const u = col / cols;
        const v = row / rows;
        let best = Infinity;
        for (let k = 0; k < lms.length; k++) {
          const du = u - lms[k].u;
          const dv = v - lms[k].v;
          const d = du * du + dv * dv;
          if (d < best) best = d;
        }
        if (best < faceR2) {
          fp = 1 + (1 - best / faceR2) * (0.4 + 0.4 * Math.sin(t * 6));
        }
      }

      const x = bx + dispX[i] + nx;
      const y = by + dispY[i] + ny;
      const z = (b - 0.5) * config.depthStrength + dispZ[i] + nz;
      const scale =
        cell * config.cubeSize * (0.2 + 0.9 * b) * a.vis * audioPulse * fp;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(scale > 0.0001 ? scale : 0.0001);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      color.setRGB(cr[i], cg[i], cb[i]);
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, mat, count]}
      frustumCulled={false}
      dispose={null}
    />
  );
}
