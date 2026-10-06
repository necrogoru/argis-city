<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";
import { storeToRefs } from "pinia";
import { useEventListener, useWindowFocus } from "@vueuse/core";
import { useLoop, useTres } from "@tresjs/core";
import { useCameraRigStore } from "../stores/cameraRig";
import { useHoverStore } from "../stores/hover";
import { useSelectionStore } from "../stores/selection";
import { createFrameDriver } from "./frameDriver";
import { fpsLimitFor } from "./frameRate";

/** Canvas pointer events: TresJS raycasts them on the next rendered frame. */
const POINTER_EVENTS = ["pointermove", "pointerdown", "pointerup", "pointerover", "pointerleave"];

const { moving } = storeToRefs(useCameraRigStore());
const hover = useHoverStore();
const selection = useSelectionStore();
const focused = useWindowFocus();
const fps = () => fpsLimitFor({ moving: moving.value, focused: focused.value });

const loop = useLoop();
const { renderer, sizes } = useTres();
const driver = createFrameDriver(loop, fps);
loop.onRender(() => driver.afterFrame());
watch(fps, () => driver.rateChanged());
// Input and what it changes render at the next vsync, not when the timer is due:
// pointer events (processed in the loop), hover / selection, and a resize
// (which clears the canvas).
useEventListener(renderer.domElement, POINTER_EVENTS, () => driver.wake(), { passive: true });
watch([() => hover.hoveredId, () => selection.selection, sizes.width, sizes.height], () => driver.wake());
onBeforeUnmount(() => driver.dispose());
</script>

<!-- Paces the render loop: display rate while the camera moves, 30/15 fps otherwise. -->
<template>
  <slot />
</template>
