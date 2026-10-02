import { Bloom, EffectComposer } from "@react-three/postprocessing";

/**
 * Neon glow: only HDR emissives (toneMapped=false, intensity > 1) cross the
 * luminance threshold, so the matte city stays crisp.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.55} luminanceSmoothing={0.2} radius={0.7} />
    </EffectComposer>
  );
}
