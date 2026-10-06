import { onUnmounted, watch } from "vue";
import { useLoop, useTres } from "@tresjs/core";
import { HalfFloatType, type WebGLRenderer } from "three";
import { BloomEffect, EffectComposer, EffectPass, FXAAEffect, RenderPass } from "postprocessing";

/**
 * Neon glow: only HDR emissives (toneMapped=false, intensity > 1) cross the
 * luminance threshold, so the matte city stays crisp.
 */
const BLOOM = { mipmapBlur: true, intensity: 0.9, luminanceThreshold: 0.55, luminanceSmoothing: 0.2, radius: 0.7 };

/**
 * Replaces the TresJS render function with one EffectComposer: RenderPass, then
 * a single EffectPass merging FXAA and Bloom (FXAA first — it resamples the
 * input and replaces the colour). FXAA instead of MSAA: the 4× MSAA half-float
 * buffer measured ~230 MB of GPU memory in a 1440×900 Retina window; FXAA adds
 * none.
 */
export function useEffectComposer(): void {
  const { renderer, scene, camera, sizes } = useTres();
  const composer = new EffectComposer(renderer as WebGLRenderer, {
    multisampling: 0,
    frameBufferType: HalfFloatType,
  });
  const fxaa = new FXAAEffect();
  const bloom = new BloomEffect(BLOOM);

  watch(
    camera,
    (active) => {
      composer.removeAllPasses();
      if (!active) return;
      composer.addPass(new RenderPass(scene.value, active));
      composer.addPass(new EffectPass(active, fxaa, bloom));
    },
    { immediate: true },
  );
  watch([sizes.width, sizes.height], ([width, height]) => composer.setSize(width, height), { immediate: true });

  useLoop().render((notifySuccess) => {
    composer.render();
    notifySuccess();
  });
  onUnmounted(() => composer.dispose());
}
