<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import { useLoop } from "@tresjs/core";
import { useCameraRigStore } from "../stores/cameraRig";

// TEMPORARY spike probe: rendered fps on screen + an animated zoom every 3 s.
const el = document.createElement("div");
el.style.cssText = "position:fixed;left:50%;top:12px;z-index:9999;font:600 28px monospace;color:#f0f;background:#000;padding:2px 8px";
document.body.append(el);
let frames = 0;
let since = performance.now();
useLoop().onRender(() => {
  frames += 1;
  const now = performance.now();
  if (now - since < 1000) return;
  el.textContent = `${Math.round((frames * 1000) / (now - since))} fps`;
  frames = 0;
  since = now;
});
const rig = useCameraRigStore();
let zoomIn = true;
const timer = setInterval(() => {
  if (zoomIn) rig.zoomIn();
  else rig.zoomOut();
  zoomIn = !zoomIn;
}, 3_000);
onBeforeUnmount(() => {
  clearInterval(timer);
  el.remove();
});
</script>

<template>
  <slot />
</template>
