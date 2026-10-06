<script setup lang="ts">
import { computed, shallowRef } from "vue";
import type { ProviderMeta } from "../domain/providers";
import { clampPercent } from "../domain/progress";
import type { DistrictModel } from "./cityModel";
import ConnectionLines from "./ConnectionLines.vue";
import House from "./house/House.vue";
import Tower from "./Tower.vue";

const props = defineProps<{ district: DistrictModel; highlighted: boolean; selectedId: string | null }>();
const emit = defineEmits<{ selectHouse: [id: string]; focus: [meta: ProviderMeta] }>();
// Template refs to three.js objects are plain shallowRefs: in dev builds useTemplateRef
// returns a readonly view that silently drops every mutation to a three.js object.
const tower = shallowRef<InstanceType<typeof Tower> | null>(null);
/** The tower body: house labels fade while it stands between them and the camera. */
const occluders = () => [tower.value?.body ?? null];
const lines = computed(() => props.district.houses.map((h) => ({ x: h.x, z: h.z, status: h.session.status })));
</script>

<!-- One provider: its tower, the houses around it and the lines joining them. -->
<template>
  <TresGroup :position="[district.x, 0, district.z]">
    <Tower
      ref="tower"
      :meta="district.meta"
      :height="district.height"
      :count="district.houses.length"
      :state="district.state"
      :highlighted="highlighted"
      @focus="emit('focus', $event)"
    />
    <ConnectionLines :houses="lines" :provider="district.provider" />
    <House
      v-for="house in district.houses"
      :key="house.session.id"
      :id="house.session.id"
      :provider="house.session.provider"
      :status="house.session.status"
      :title="house.session.title"
      :percent="clampPercent(house.session.progress.percent)"
      :index="house.number - 1"
      :ring="house.ring"
      :x="house.x"
      :z="house.z"
      :selected="house.session.id === selectedId"
      :occluders="occluders"
      @select="emit('selectHouse', $event)"
    />
  </TresGroup>
</template>
