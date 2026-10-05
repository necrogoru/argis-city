import { Bloom, EffectComposer, FXAA } from "@react-three/postprocessing";

/**
 * Neon glow: only HDR emissives (toneMapped=false, intensity > 1) cross the
 * luminance threshold, so the matte city stays crisp.
 *
 * Antialiasing is FXAA merged into the same pass rather than MSAA: the 4× MSAA
 * half-float buffer measured ~230 MB of GPU memory in a 1440×900 Retina
 * window; FXAA adds none. It must come first — it resamples the input and
 * replaces the colour.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <FXAA />
      <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.55} luminanceSmoothing={0.2} radius={0.7} />
    </EffectComposer>
  );
}
