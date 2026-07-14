# VoxelFace — Webcam Particle Face Visualizer

A live 3D **voxel portrait** built with **Next.js 16 (App Router)** and **React Three Fiber**. Your webcam feed is recreated as thousands of animated cubes: every sampled pixel becomes a small block whose color, size and depth are driven by the live video — forming a cinematic, hologram-like sculpture of your face.

No camera? A built-in **Demo Mode** feeds a synthetic animated face so everything is explorable without hardware. Video never leaves the device — all processing is local.

## Run

```bash
npm run dev      # http://localhost:3000
npm run build && npm start
```

Click **Enable Camera** (or **Demo Mode**) to start.

## How it works

- **One `InstancedMesh`** holds every cube — no per-particle React components. All motion, color and matrix updates happen inside a single `useFrame` loop that mutates typed arrays directly, so slider tweaks and animation never trigger React re-renders.
- Each frame the source is drawn into a small offscreen canvas at grid resolution; pixels are read once (`willReadFrequently`) and mapped to instance matrices + `instanceColor`.
- **Brightness → Z depth** and **→ cube scale**; values are temporally smoothed to avoid flicker.
- A **decay-based displacement model** gives the scatter→assemble intro, the mouse force field (repel + swirl) that springs back, and the explode/dissolve — all from one buffer.
- A patched `MeshStandardMaterial` routes each instance's color into its emissive term, so bright voxels **bloom in their own hue** while still receiving scene lighting.

## Controls

**Keyboard** — `Space` pause · `R` reassemble · `E` explode · `C` cycle color mode

**Leva panel** (top-right) — particle count, cube size, spacing, depth strength, brightness, noise intensity/speed, mouse force/radius/swirl, return speed, bloom, animation speed, auto-rotate, and toggles for face-pulse & mic-reactive. Drag anywhere to orbit; scroll to zoom.

**Color modes** — Webcam · White · Neon Blue · Rainbow · Wireframe

## Optional extras

- **Face pulse** — MediaPipe FaceLandmarker (lazy-loaded from CDN) makes voxels near the eyes/nose/mouth pulse. Toggle in the *Extras* folder.
- **Mic reactive** — microphone amplitude gently pulses voxel scale.

Both are off by default, load on demand, and fail gracefully.

## Structure

```
src/
  app/                  page.tsx · layout.tsx · globals.css
  components/           Experience · Scene · ParticleRenderer · Controls · WebcamCapture
  hooks/                useWebcam · useParticles · useAudio · useFaceMesh
  lib/                  particleUtils · webcamUtils
  shaders/              instancedEmissive (material patch)
```

## Tech

Next.js 16 · React 19 · TypeScript · Three.js · @react-three/fiber · @react-three/drei · @react-three/postprocessing · leva · simplex-noise · @mediapipe/tasks-vision · Tailwind CSS v4
