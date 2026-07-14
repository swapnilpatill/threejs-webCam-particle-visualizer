"use client";

import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import ParticleRenderer from "./ParticleRenderer";
import type { EngineState, VizConfig } from "@/lib/particleUtils";
import type { PixelSource } from "@/lib/webcamUtils";

interface Props {
  config: VizConfig;
  engine: EngineState;
  sourceRef: React.RefObject<PixelSource | null>;
  sourceReady: boolean;
}

/** Writes pointer position (as NDC) into the engine for the mouse force field. */
function useGlobalPointer(engine: EngineState) {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      engine.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      engine.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      engine.mouseActive = true;
      engine.mouseMoveT = performance.now();
    };
    const leave = () => {
      engine.mouseActive = false;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerleave", leave);
    };
  }, [engine]);
}

export default function Scene({ config, engine, sourceRef, sourceReady }: Props) {
  useGlobalPointer(engine);

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 108], fov: 50, near: 0.1, far: 2000 }}
      onCreated={({ gl }) => {
        gl.setClearColor("#050505");
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
      }}
    >
      <color attach="background" args={["#050505"]} />
      <fog attach="fog" args={["#050505", 130, 360]} />

      <ambientLight intensity={0.55} />
      <directionalLight position={[40, 60, 90]} intensity={1.3} />
      <directionalLight position={[-70, -20, 40]} intensity={0.5} color="#3366ff" />

      <ParticleRenderer
        config={config}
        engine={engine}
        sourceRef={sourceRef}
        sourceReady={sourceReady}
      />

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate={config.autoRotate}
        autoRotateSpeed={0.6}
        minDistance={40}
        maxDistance={420}
      />

      <EffectComposer>
        <Bloom
          intensity={config.bloomIntensity}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}
