<script setup lang="ts">
import { computed, shallowRef, watch, watchEffect } from "vue";
import { useTres } from "@tresjs/core";
import { BaseCameraControls, CameraControls } from "@tresjs/cientos";
import { OrthographicCamera } from "three";
import type { ProviderId } from "../domain/types";
import { useCameraRigStore } from "../stores/cameraRig";
import type { CityModel } from "./cityModel";
import { MAX_ZOOM, MIN_ZOOM } from "./layout";
import { fitOrthographicFrustum } from "./orthographicFrustum";

const { ACTION } = BaseCameraControls;
// Map-like: left drag pans, right drag orbits, wheel zooms to the cursor.
const MOUSE = { left: ACTION.TRUCK, middle: ACTION.ZOOM, right: ACTION.ROTATE, wheel: ACTION.ZOOM };
const TOUCH = { one: ACTION.TOUCH_TRUCK, two: ACTION.TOUCH_ZOOM_TRUCK, three: ACTION.NONE };
/** Camera activity events; "moving" clears this long after the last one. */
const ACTIVITY = ["controlstart", "control", "transitionstart", "update", "wake"] as const;
const MOVE_GRACE_MS = 150;

const props = defineProps<{ city: CityModel; hasData: boolean; focusedProvider: ProviderId | null }>();
const rig = useCameraRigStore();
const { camera, sizes } = useTres();
// Template refs to three.js objects are plain shallowRefs: in dev builds useTemplateRef
// returns a readonly view that silently drops every mutation to a three.js object.
const controlsComponent = shallowRef<InstanceType<typeof CameraControls> | null>(null);
const controls = computed(() => controlsComponent.value?.instance ?? null);

// TresJS resizes only perspective cameras: keep the orthographic frustum at
// one world unit per CSS pixel, as layout.ts's fitZoom assumes.
watchEffect(() => {
  const active = camera.value;
  if (active instanceof OrthographicCamera && sizes.width.value && sizes.height.value) {
    fitOrthographicFrustum(active, sizes.width.value, sizes.height.value);
  }
});

// Attach the controls to the rig; any camera activity lifts the frame-rate cap
// until MOVE_GRACE_MS after the last event (covers a press that never moves).
watch(
  controls,
  (next, _previous, onCleanup) => {
    rig.attach(next);
    if (!next) return;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const bump = () => {
      rig.setMoving(true);
      clearTimeout(idle);
      idle = setTimeout(() => rig.setMoving(false), MOVE_GRACE_MS);
    };
    ACTIVITY.forEach((type) => next.addEventListener(type, bump));
    onCleanup(() => {
      ACTIVITY.forEach((type) => next.removeEventListener(type, bump));
      clearTimeout(idle);
      rig.setMoving(false);
      rig.attach(null);
    });
  },
  { immediate: true },
);

watch(
  () => [sizes.width.value, sizes.height.value, props.city] as const,
  ([width, height, city]) => rig.update({ width, height }, city),
  { immediate: true },
);

// First real data: frame the city without animation (once the controls exist).
let framed = false;
watch(
  [controls, () => props.hasData],
  ([attached, hasData]) => {
    if (!attached || !hasData || framed) return;
    framed = true;
    rig.update({ width: sizes.width.value, height: sizes.height.value }, props.city);
    rig.fit(false);
  },
  { immediate: true },
);

// District focus from the hero list / tower clicks; clearing it re-frames the city.
watch(
  () => props.focusedProvider,
  (provider) => {
    if (!framed) return;
    if (provider) rig.focus(provider);
    else rig.fit();
  },
);
</script>

<!-- In-canvas half of the camera rig: owns CameraControls and reacts to focus. -->
<template>
  <CameraControls
    ref="controlsComponent"
    make-default
    :min-zoom="MIN_ZOOM"
    :max-zoom="MAX_ZOOM"
    :min-polar-angle="0.55"
    :max-polar-angle="1.1"
    :smooth-time="0.32"
    dolly-to-cursor
    :mouse-buttons="MOUSE"
    :touches="TOUCH"
  />
</template>
