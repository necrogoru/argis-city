<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<!-- Small boxed metric: label, 24/500 value, caption. -->
<template>
  <div class="tile">
    <span class="label">{{ label }}</span>
    <span class="value"><slot name="value" /></span>
    <span class="caption"><slot name="caption" /></span>
  </div>
</template>

<style scoped>
.tile {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  border-radius: var(--radius-card);
  background: var(--fill-subtle);
  border: 1px solid var(--border);
}

.label {
  font-size: 12px;
  color: var(--text-3);
}

.value {
  font-size: 24px;
  font-weight: 500;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.caption {
  font-size: 11.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
