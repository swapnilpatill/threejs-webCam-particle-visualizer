import * as THREE from "three";

/**
 * A MeshStandardMaterial patched so each instance's color also drives its
 * emissive output. This makes bright voxels bloom in their own hue (the
 * hologram / LED glow) while still receiving real scene lighting for the
 * cinematic, shaded look. The strength is controlled at runtime via the
 * `uEmissive` uniform (updated per color mode).
 *
 * If the shader chunk ever fails to match, the material still renders
 * correctly — just without the extra emissive contribution.
 */
export function makeVoxelMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.45,
    metalness: 0.15,
    toneMapped: true,
  });

  const uniforms = { uEmissive: { value: 0.2 } };

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uEmissive = uniforms.uEmissive;
    shader.fragmentShader = "uniform float uEmissive;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      #ifdef USE_INSTANCING_COLOR
        totalEmissiveRadiance += vColor.rgb * uEmissive;
      #endif`,
    );
  };
  // Keep every instance of this material on one compiled program.
  mat.customProgramCacheKey = () => "voxel-emissive-material";

  return { mat, uniforms };
}
