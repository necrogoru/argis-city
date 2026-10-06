<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { PROVIDERS } from "../domain/providers";
import type { ProviderId } from "../domain/types";
import { buildConnections, connectionKey, type LineHouse } from "./connectionModel";
import FlowLine from "./FlowLine.vue";
import SegmentLines from "./SegmentLines.vue";

const props = defineProps<{ houses: readonly LineHouse[]; provider: ProviderId }>();
// Keyed on positions + statuses, not on the per-snapshot array identity.
const key = computed(() => `${props.provider}|${connectionKey(props.houses)}`);
const model = shallowRef(buildConnections(props.houses, props.provider));
watch(key, () => {
  model.value = buildConnections(props.houses, props.provider);
});
</script>

<!-- Status-tinted lines from every house lot to its tower (2 draw calls max). -->
<template>
  <template v-if="model.base.length > 0">
    <SegmentLines :points="model.base" :vertex-colors="model.baseColors" :line-width="1.2" />
    <FlowLine v-if="model.flow.length > 0" :points="model.flow" :hex="PROVIDERS[provider].hex" />
  </template>
</template>
