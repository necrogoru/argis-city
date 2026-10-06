<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";
import { storeToRefs } from "pinia";
import { useWindowFocus } from "@vueuse/core";
import { useLoop } from "@tresjs/core";
import { useCameraRigStore } from "../stores/cameraRig";
import { createFrameDriver } from "./frameDriver";
import { fpsLimitFor } from "./frameRate";

const { moving } = storeToRefs(useCameraRigStore());
const focused = useWindowFocus();
const fps = () => fpsLimitFor({ moving: moving.value, focused: focused.value });

const loop = useLoop();
const driver = createFrameDriver(loop, fps);
loop.onRender(() => driver.afterFrame());
watch(fps, () => driver.rateChanged());
onBeforeUnmount(() => driver.dispose());
</script>

<!-- Paces the render loop: display rate while the camera moves, 30/15 fps otherwise. -->
<template>
  <slot />
</template>
