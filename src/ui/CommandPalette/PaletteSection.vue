<script setup lang="ts">
import { useId } from "vue";

defineProps<{ title: string; aside?: string | null }>();
const headingId = useId();
</script>

<template>
  <div role="group" :aria-labelledby="headingId" class="section">
    <div class="heading">
      <span :id="headingId" class="caps">{{ title }}</span>
      <span v-if="aside" class="aside">{{ aside }}</span>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 12px 6px;
}

.aside {
  font-size: 11.5px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}
</style>
