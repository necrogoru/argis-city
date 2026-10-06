<script setup lang="ts">
import { shallowRef } from "vue";
import type { MeshStandardMaterial } from "three";
import type { HouseVisual } from "../../domain/houseVisuals";
import { useHouseGlow } from "../../composables/useHouseGlow";
import { HOUSE, houseKeyWindowGeometry, houseRestWindowGeometry, roofGeometry, unitBox } from "../geometries";
import { GLOW_BASE_COLOR, lotMaterial } from "../materials";

const props = defineProps<{ visual: HouseVisual; phase: number; hovered: boolean }>();
// Mount with the right colours (bound once); afterwards useHouseGlow eases every change.
const initial = props.visual;
// Template refs to three.js objects are plain shallowRefs: in dev builds useTemplateRef
// returns a readonly view that silently drops every mutation to a three.js object.
const keyWindows = shallowRef<MeshStandardMaterial | null>(null);
const restWindows = shallowRef<MeshStandardMaterial | null>(null);
const roof = shallowRef<MeshStandardMaterial | null>(null);
const body = shallowRef<MeshStandardMaterial | null>(null);
useHouseGlow(
  { keyWindows, restWindows, roof, body },
  () => props.visual,
  () => props.phase,
  () => props.hovered,
);
</script>

<!-- Lot, matte body, pyramid roof and windows — lit and animated by status. -->
<template>
  <TresMesh
    :geometry="unitBox"
    :material="lotMaterial"
    :scale="[HOUSE.lot, 0.05, HOUSE.lot]"
    :position-y="0.025"
    receive-shadow
  />
  <TresMesh
    :geometry="unitBox"
    :scale="[HOUSE.width, HOUSE.height, HOUSE.width]"
    :position-y="HOUSE.height / 2"
    cast-shadow
    receive-shadow
  >
    <TresMeshStandardMaterial ref="body" :color="initial.bodyHex" :roughness="0.88" :metalness="0.12" />
  </TresMesh>
  <TresMesh :geometry="houseKeyWindowGeometry">
    <TresMeshStandardMaterial ref="keyWindows" :color="GLOW_BASE_COLOR" :emissive="initial.hex" :tone-mapped="false" />
  </TresMesh>
  <TresMesh :geometry="houseRestWindowGeometry">
    <TresMeshStandardMaterial ref="restWindows" :color="GLOW_BASE_COLOR" :emissive="initial.hex" :tone-mapped="false" />
  </TresMesh>
  <TresMesh :geometry="roofGeometry" cast-shadow>
    <TresMeshStandardMaterial ref="roof" color="#202427" :roughness="0.75" :emissive="initial.hex" :tone-mapped="false" />
  </TresMesh>
</template>
