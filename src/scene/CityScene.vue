<script setup lang="ts">
import { computed } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { storeToRefs } from "pinia";
import type { ProviderMeta } from "../domain/providers";
import { resolveHouseCursorNavigation } from "../domain/houseNavigation";
import { resolveHouseNavigationKeyAction } from "../domain/houseNavigationKeys";
import { useSelectionStore } from "../stores/selection";
import type { CityModel } from "./cityModel";
import District from "./District.vue";
import Ground from "./Ground.vue";

const props = defineProps<{ city: CityModel }>();
const selectionStore = useSelectionStore();
const { selection, houseCursorId } = storeToRefs(selectionStore);
const orderedHouseIds = computed(() => props.city.districts.flatMap((district) => district.houses.map((house) => house.session.id)));
const selectedProvider = computed(
  () => props.city.districts.find((d) => d.houses.some((h) => h.session.id === selection.value.sessionId))?.provider,
);
const onFocus = (meta: ProviderMeta) => selectionStore.focusProvider(meta.id);

onKeyStroke((event) => {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const hasOpenDialog = document.querySelector("dialog[open]") !== null;
  const action = resolveHouseNavigationKeyAction(event, target, hasOpenDialog);
  if (!action) return;

  if (action.type === "move") {
    const sessionId = resolveHouseCursorNavigation(
      orderedHouseIds.value,
      action.direction,
      houseCursorId.value,
      selection.value.sessionId,
    );
    if (!sessionId) return;
    event.preventDefault();
    selectionStore.setHouseCursor(sessionId);
    return;
  }

  const sessionId = houseCursorId.value;
  if (!sessionId) return;
  event.preventDefault();
  selectionStore.selectSession(sessionId);
});
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
    :keyboard-cursor-id="houseCursorId"
    @select-house="selectionStore.selectSession($event)"
    @focus="onFocus"
  />
</template>
