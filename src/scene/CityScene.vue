<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import type { ProviderMeta } from "../domain/providers";
import { useSelectionStore } from "../stores/selection";
import type { CityModel } from "./cityModel";
import District from "./District.vue";
import Ground from "./Ground.vue";

const props = defineProps<{ city: CityModel }>();
const selectionStore = useSelectionStore();
const { selection } = storeToRefs(selectionStore);
const selectedProvider = computed(
  () => props.city.districts.find((d) => d.houses.some((h) => h.session.id === selection.value.sessionId))?.provider,
);
const onFocus = (meta: ProviderMeta) => selectionStore.focusProvider(meta.id);
</script>

<!-- Ground + all four districts, wired to the shared selection state. -->
<template>
  <Ground @deselect="selectionStore.clearSession()" />
  <District
    v-for="district in city.districts"
    :key="district.provider"
    :district="district"
    :highlighted="selection.provider === district.provider || selectedProvider === district.provider"
    :selected-id="selection.sessionId"
    @select-house="selectionStore.selectSession($event)"
    @focus="onFocus"
  />
</template>
