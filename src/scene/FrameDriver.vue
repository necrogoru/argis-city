<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";
import { storeToRefs } from "pinia";
import { useEventListener, useWindowFocus } from "@vueuse/core";
import { useLoop, useTres } from "@tresjs/core";
import { useCameraRigStore } from "../stores/cameraRig";
import { useHoverStore } from "../stores/hover";
import { useSelectionStore } from "../stores/selection";
import { createFrameDriver, onTargetChange } from "./frameDriver";
import { fpsLimitFor } from "./frameRate";

/** Canvas pointer events that can change what the city shows (not plain moves). */
const POINTER_EVENTS = ["pointerdown", "pointerup", "pointerover", "pointerleave"];

const { moving } = storeToRefs(useCameraRigStore());
const hover = useHoverStore();
const selection = useSelectionStore();
const focused = useWindowFocus();
const fps = () => fpsLimitFor({ moving: moving.value, focused: focused.value });

const loop = useLoop();
const { renderer, scene, sizes } = useTres();
const driver = createFrameDriver(loop, fps);
loop.onRender(() => driver.afterFrame());
watch(fps, () => driver.rateChanged());
// Input and what it changes render at the next vsync, not when the timer is due:
// canvas presses / enter / leave, a pointer move onto a different object (hover
// lift and glow), hover / selection changes, and a resize (which clears the canvas).
useEventListener(renderer.domElement, POINTER_EVENTS, () => driver.wake(), { passive: true });
const onPointerMove = onTargetChange(() => driver.wake());
scene.value.addEventListener("pointermove", onPointerMove);
watch([() => hover.hoveredId, () => selection.selection, sizes.width, sizes.height], () => driver.wake());
onBeforeUnmount(() => {
  scene.value.removeEventListener("pointermove", onPointerMove);
  driver.dispose();
});
</script>

<!-- Paces the render loop: display rate while the camera moves, 30/15 fps otherwise. -->
<template>
  <slot />
</template>
