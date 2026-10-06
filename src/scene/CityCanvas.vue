<script setup lang="ts">
import { computed, provide, useTemplateRef } from "vue";
import { storeToRefs } from "pinia";
import { TresCanvas } from "@tresjs/core";
import { Color, NoToneMapping, PCFShadowMap } from "three";
import { PALETTE } from "../domain/palette";
import { labelLayerKey } from "../composables/useLabelLayer";
import { useSelectionStore } from "../stores/selection";
import { useSnapshotStore } from "../stores/snapshot";
import { buildCity } from "./cityModel";
import CameraRigBinding from "./CameraRigBinding.vue";
import CityScene from "./CityScene.vue";
import Effects from "./Effects.vue";
import FrameDriver from "./FrameDriver.vue";
import Lights from "./Lights.vue";

const CAMERA_POSITION: [number, number, number] = [60, 60, 60];
/**
 * Capped below Retina 2×: under bloom + FXAA it reads almost the same, and
 * every full-screen buffer (canvas, composer, bloom) shrinks by ~44% — about
 * 100 MB less GPU memory.
 */
const DPR: [number, number] = [1, 1.5];
/** Scene background, matching the page behind the canvas and the fog. */
const background = new Color(PALETTE.bg);

const { snapshot } = storeToRefs(useSnapshotStore());
const { selection } = storeToRefs(useSelectionStore());
const city = computed(() => buildCity(snapshot.value));

const labels = useTemplateRef<HTMLDivElement>("labels");
provide(labelLayerKey, labels);
</script>

<!-- Full-bleed isometric WebGL city behind the UI overlay. -->
<template>
  <div class="layer">
    <!--
      The scene composer replaces TresJS's render, so the canvas only receives the
      final full-screen pass: no depth buffer needed, and an opaque canvas is
      cheaper for the compositor to blend. No tone mapping, as under
      @react-three/postprocessing: the HDR emissives feed bloom untouched.
    -->
    <TresCanvas
      :dpr="DPR"
      :antialias="false"
      :alpha="false"
      :depth="false"
      shadows
      :shadow-map-type="PCFShadowMap"
      :tone-mapping="NoToneMapping"
    >
      <FrameDriver />
      <TresOrthographicCamera :position="CAMERA_POSITION" :zoom="22" :near="0.1" :far="1000" />
      <primitive :object="background" attach="background" />
      <TresFog attach="fog" :args="[PALETTE.bg, 110, 175]" />
      <!-- First, so the controls update before the labels project each frame. -->
      <CameraRigBinding :city="city" :has-data="snapshot != null" :focused-provider="selection.provider" />
      <Lights />
      <CityScene :city="city" />
      <Effects />
    </TresCanvas>
    <div ref="labels" class="labels" />
  </div>
</template>

<style scoped>
.layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  /* Own stacking context: in-scene HTML labels can never cover the overlay. */
  isolation: isolate;
}

/* Same box as the canvas so the Html labels' projected coordinates line up. */
.labels {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
  pointer-events: none;
}
</style>
