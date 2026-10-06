<script setup lang="ts">
import { computed } from "vue";
import { highlight } from "../../domain/search";

const props = defineProps<{ text: string; query: string }>();
const segments = computed(() => highlight(props.text, props.query));
</script>

<!-- `text` with the parts matching `query` emphasised. -->
<template>
  <template v-for="(segment, i) in segments" :key="i">
    <mark v-if="segment.match" class="mark">{{ segment.text }}</mark>
    <template v-else>{{ segment.text }}</template>
  </template>
</template>

<style scoped>
.mark {
  background: none;
  color: var(--teal);
}
</style>
