<script setup lang="ts">
import { Building } from "@lucide/vue";

/** Product name exactly as in the approved design. */
const BRAND_NAME = "AgentCity";
</script>

<template>
  <div class="brand">
    <Building :size="24" :stroke-width="1.9" class="icon" aria-hidden="true" />
    <span class="name">{{ BRAND_NAME }}</span>
  </div>
</template>

<style scoped>
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.icon {
  color: var(--teal);
  filter: drop-shadow(0 0 8px rgba(50, 243, 226, 0.45));
}

.name {
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.3px;
}
</style>
