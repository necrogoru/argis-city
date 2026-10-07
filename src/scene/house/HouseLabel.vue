<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { Html } from "@tresjs/cientos";
import type { Group, Object3D } from "three";
import type { AgentStatus } from "../../domain/types";
import { truncateLabel } from "../../domain/format";
import { statusHex } from "../../domain/status";
import { useLabelLayer } from "../../composables/useLabelLayer";
import { useOcclusion } from "../../composables/useOcclusion";
import { HOUSE_TOP } from "../geometries";

/** World height above the roof: leaves room for beacons / halos underneath. */
const LABEL_Y = HOUSE_TOP + 0.95;

const props = defineProps<{
  title: string;
  status: AgentStatus;
  /** Resting opacity (dimmer for idle / done). */
  opacity: number;
  hovered: boolean;
  /** Extra px lift to de-collide mirror-image neighbours. */
  lift: number;
  /** Meshes (the district tower) that fade this label while in front of it. */
  occluders: () => readonly (Object3D | null)[];
}>();
const emit = defineEmits<{ select: []; enter: []; leave: [] }>();
const layer = useLabelLayer();
// Template refs to three.js objects are plain shallowRefs: in dev builds useTemplateRef
// returns a readonly view that silently drops every mutation to a three.js object.
const anchor = shallowRef<Group | null>(null);
const occluded = useOcclusion(anchor, () => props.occluders());
const style = computed(() => ({
  "--dot": statusHex(props.status),
  "--lift": `${props.lift}px`,
  "--rest-opacity": props.opacity,
}));
</script>

<!--
  Always-visible name pill above a house. Pointer convenience only (the agent
  list is the keyboard path), so it is hidden from assistive tech.
-->
<template>
  <TresGroup ref="anchor" :position="[0, LABEL_Y, 0]">
    <Html v-if="layer" :portal="layer" :z-index-range="[40, 0]" pointer-events="none">
      <div
        class="label"
        :style="style"
        :data-status="status"
        :data-hovered="hovered"
        :data-occluded="occluded"
        :title="title"
        aria-hidden="true"
        @click="emit('select')"
        @pointerenter="emit('enter')"
        @pointerleave="emit('leave')"
      >
        <span class="dot" />
        <span class="text">{{ truncateLabel(title) }}</span>
      </div>
    </Html>
  </TresGroup>
</template>

<style scoped>
.label {
  pointer-events: auto;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 9px 0 7px;
  border-radius: 8px;
  white-space: nowrap;
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text);
  background: rgba(17, 19, 20, 0.78);
  border: 1px solid var(--border);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transform: translate(-50%, calc(-100% - var(--lift)));
  opacity: var(--rest-opacity);
  user-select: none;
  transition: opacity 300ms ease, border-color 160ms ease, background-color 160ms ease;
}

/* Behind its tower: keep it findable but out of the way. */
.label[data-occluded="true"] {
  opacity: calc(var(--rest-opacity) * 0.3);
}

.label[data-hovered="true"] {
  opacity: 1;
  background: rgba(24, 27, 29, 0.92);
  border-color: color-mix(in srgb, var(--dot) 55%, transparent);
}

.dot {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: var(--dot);
  box-shadow: 0 0 6px var(--dot);
}

.label[data-status="awaitingApproval"] {
  border-color: color-mix(in srgb, var(--amber) 35%, transparent);
}

.label[data-status="awaitingApproval"] .dot {
  animation: urgent 1.2s ease-in-out infinite;
}

.text {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Opacity only (the glow fades with it): stays on the compositor. */
@keyframes urgent {
  50% {
    opacity: 0.25;
  }
}
</style>
