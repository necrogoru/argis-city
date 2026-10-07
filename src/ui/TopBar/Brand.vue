<script setup lang="ts">
import ArgisLogo from "./ArgisLogo.vue";

const BRAND_NAME = "Argis";
</script>

<template>
  <div class="brand">
    <ArgisLogo :size="36" />
    <span class="name">{{ BRAND_NAME }}</span>
  </div>
</template>

<style scoped>
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
}

.name {
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.3px;
}
</style>
