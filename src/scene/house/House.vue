<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import type { Group, Object3D } from "three";
import type { AgentStatus, ProviderId } from "../../domain/types";
import { PALETTE } from "../../domain/palette";
import { housePhase, houseVisual } from "../../domain/houseVisuals";
import { useCursor } from "../../composables/useCursor";
import { useDoneRipple } from "../../composables/useDoneRipple";
import { useHouseMotion } from "../../composables/useHouseMotion";
import { useHoverSources } from "../../composables/useHoverSources";
import { usePressClick } from "../../composables/usePressClick";
import { useHoverStore } from "../../stores/hover";
import { HOUSE_TOP, selectionRingGeometry } from "../geometries";
import { labelLift } from "../layout";
import { selectionRingMaterial } from "../materials";
import GroundPulse from "./GroundPulse.vue";
import HouseBeacon from "./HouseBeacon.vue";
import HouseLabel from "./HouseLabel.vue";
import HouseMarker from "./HouseMarker.vue";
import HouseShell from "./HouseShell.vue";

const props = defineProps<{
  id: string;
  provider: ProviderId;
  status: AgentStatus;
  title: string;
  /** Short progress readout for the selection marker: `68%`, `ctx 74%` or `—`. */
  progress: string;
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
const hover = useHoverStore();
const hovered = computed(() => hover.hoveredId === props.id);
const visual = computed(() => houseVisual(props.status, props.provider));
const phase = computed(() => housePhase(props.id));
const ripples = useDoneRipple(() => props.status);
// The house is hovered while the pointer is on its mesh or on its label.
const sources = useHoverSources(() => props.id, hover);
useCursor(sources.mesh);
useHouseMotion(group, () => props.x, () => props.z, () => hovered.value || props.selected);

const select = () => emit("select", props.id);
const press = usePressClick(select, { stop: true });
// Selecting swaps the label for the marker; an unmounted label never reports its leave.
watch(
  () => props.selected,
  (selected) => selected && sources.labelLeave(),
);

function onPointerover(event: { stopPropagation(): void }) {
  event.stopPropagation();
  sources.meshOver();
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
    @pointerout="sources.meshOut()"
  >
    <HouseShell :visual="visual" :phase="phase" :hovered="hovered" />
    <HouseBeacon :visual="visual" :phase="phase" />
    <GroundPulse v-if="visual.groundPulse" :hex="visual.hex" loop />
    <GroundPulse v-if="ripples > 0" :key="ripples" :hex="PALETTE.blue" />
    <template v-if="selected">
      <TresMesh :geometry="selectionRingGeometry" :material="selectionRingMaterial" :position-y="0.06" />
      <HouseMarker :position="[0, HOUSE_TOP + 0.05, 0]" :title="title" :progress="progress" />
    </template>
    <HouseLabel
      v-else
      :title="title"
      :status="status"
      :opacity="visual.labelOpacity"
      :hovered="hovered"
      :lift="labelLift(index, ring)"
      :occluders="occluders"
      @select="select"
      @enter="sources.labelEnter()"
      @leave="sources.labelLeave()"
    />
  </TresGroup>
</template>
