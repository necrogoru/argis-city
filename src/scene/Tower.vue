<script setup lang="ts">
import { ref, shallowRef } from "vue";
import { useLoop } from "@tresjs/core";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import type { ProviderMeta } from "../domain/providers";
import { useCursor } from "../composables/useCursor";
import { usePressClick } from "../composables/usePressClick";
import type { DistrictState } from "./cityModel";
import { roofPanelGeometry, TOWER, towerStripGeometry, unitBox } from "./geometries";
import { GLOW_BASE_COLOR, plinthMaterial, towerBodyMaterial, towerCrownMaterial } from "./materials";
import TowerLabel from "./TowerLabel.vue";

const props = defineProps<{
  meta: ProviderMeta;
  height: number;
  count: number;
  state: DistrictState;
  highlighted: boolean;
}>();
const emit = defineEmits<{ focus: [meta: ProviderMeta] }>();

// Template refs to three.js objects are plain shallowRefs: in dev builds useTemplateRef
// returns a readonly view that silently drops every mutation to a three.js object.
const bodyGroup = shallowRef<Group | null>(null);
const top = shallowRef<Group | null>(null);
const strips = shallowRef<MeshStandardMaterial | null>(null);
const panels = shallowRef<MeshStandardMaterial | null>(null);
/** Body mesh, used to fade house labels hidden behind the tower. */
const body = shallowRef<Mesh | null>(null);
defineExpose({ body });

// Mount at the right height; afterwards the loop eases every change.
const initialHeight = props.height;
const hovered = ref(false);
useCursor(hovered);
const press = usePressClick(() => emit("focus", props.meta), { stop: true });

useLoop().onBeforeRender(({ delta, elapsed }) => {
  if (!bodyGroup.value || !top.value) return;
  const h = bodyGroup.value.scale.y + (props.height - bodyGroup.value.scale.y) * (1 - Math.exp(-delta * 4));
  bodyGroup.value.scale.y = h;
  top.value.position.y = h;
  const base = props.state === "live" ? 1.6 + 0.2 * Math.sin(elapsed * 1.3) : props.state === "empty" ? 0.22 : 0.08;
  const boost = hovered.value || props.highlighted ? 1.3 : 1;
  if (strips.value) strips.value.emissiveIntensity = base * boost;
  if (panels.value) panels.value.emissiveIntensity = base * 1.4 * boost;
});

function onPointerover(event: { stopPropagation(): void }) {
  event.stopPropagation();
  hovered.value = true;
}
</script>

<!-- Provider tower: matte body, emissive strips and roof panels, eased height. -->
<template>
  <TresGroup
    @pointerdown="press.onPointerdown"
    @pointerup="press.onPointerup"
    @pointerover="onPointerover"
    @pointerout="hovered = false"
  >
    <TresMesh
      :geometry="unitBox"
      :material="plinthMaterial"
      :scale="[TOWER.plinth, 0.12, TOWER.plinth]"
      :position-y="0.06"
      receive-shadow
    />
    <TresGroup ref="bodyGroup" :scale-y="initialHeight">
      <TresMesh
        ref="body"
        :geometry="unitBox"
        :material="towerBodyMaterial"
        :scale="[TOWER.width, 1, TOWER.width]"
        :position-y="0.5"
        cast-shadow
        receive-shadow
      />
      <TresMesh :geometry="towerStripGeometry">
        <TresMeshStandardMaterial ref="strips" :color="GLOW_BASE_COLOR" :emissive="meta.hex" :tone-mapped="false" />
      </TresMesh>
    </TresGroup>
    <TresGroup ref="top" :position-y="initialHeight">
      <TresMesh
        :geometry="unitBox"
        :material="towerCrownMaterial"
        :scale="[TOWER.crown, TOWER.crownHeight, TOWER.crown]"
        :position-y="TOWER.crownHeight / 2"
        cast-shadow
      />
      <TresMesh :geometry="roofPanelGeometry" :position-y="TOWER.crownHeight + 0.02">
        <TresMeshStandardMaterial ref="panels" :color="GLOW_BASE_COLOR" :emissive="meta.hex" :tone-mapped="false" />
      </TresMesh>
      <TowerLabel
        :position="[0, TOWER.crownHeight + 0.1, 0]"
        :meta="meta"
        :count="count"
        :state="state"
        :highlighted="highlighted"
        @focus="emit('focus', $event)"
      />
    </TresGroup>
  </TresGroup>
</template>
