<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import type { Group, Object3D } from "three";
import type { AgentStatus, ProviderId } from "../../domain/types";
import { housePhase, houseVisual } from "../../domain/houseVisuals";
import { useCursor } from "../../composables/useCursor";
import { useHouseMotion } from "../../composables/useHouseMotion";
import { usePressClick } from "../../composables/usePressClick";
import { useHoverStore } from "../../stores/hover";
import { labelLift } from "../layout";
import HouseLabel from "./HouseLabel.vue";
import HouseShell from "./HouseShell.vue";

const props = defineProps<{
  id: string;
  provider: ProviderId;
  status: AgentStatus;
  title: string;
  percent: number | null;
  /** 0-based index and ring within the district (label stagger). */
  index: number;
  ring: number;
  /** Target offset from the tower; the house eases towards it. */
  x: number;
  z: number;
  selected: boolean;
  /** Meshes (the district tower) that can hide this house's label. */
  occluders: () => readonly (Object3D | null)[];
}>();
const emit = defineEmits<{ select: [id: string] }>();

// Template refs to three.js objects are plain shallowRefs: in dev builds useTemplateRef
// returns a readonly view that silently drops every mutation to a three.js object.
const group = shallowRef<Group | null>(null);
const initial: [number, number, number] = [props.x, 0, props.z];
const pointerOver = ref(false);
const hover = useHoverStore();
const hovered = computed(() => hover.hoveredId === props.id);
const visual = computed(() => houseVisual(props.status, props.provider));
const phase = computed(() => housePhase(props.id));
useCursor(pointerOver);
useHouseMotion(group, () => props.x, () => props.z, () => hovered.value || props.selected);

const select = () => emit("select", props.id);
const enter = () => hover.set(props.id);
const leave = () => hover.clear(props.id);
const press = usePressClick(select, { stop: true });

function onPointerover(event: { stopPropagation(): void }) {
  event.stopPropagation();
  pointerOver.value = true;
  enter();
}
function onPointerout() {
  pointerOver.value = false;
  leave();
}
</script>

<!-- One live session: shell + status effects + name label (or marker when selected). -->
<template>
  <TresGroup
    ref="group"
    :position="initial"
    @pointerdown="press.onPointerdown"
    @pointerup="press.onPointerup"
    @pointerover="onPointerover"
    @pointerout="onPointerout"
  >
    <HouseShell :visual="visual" :phase="phase" :hovered="hovered" />
    <HouseLabel
      v-if="!selected"
      :title="title"
      :status="status"
      :opacity="visual.labelOpacity"
      :hovered="hovered"
      :lift="labelLift(index, ring)"
      :occluders="occluders"
      @select="select"
      @enter="enter"
      @leave="leave"
    />
  </TresGroup>
</template>
