<script setup lang="ts">
import DistrictList from "./DistrictList.vue";
import HeroHeading from "./HeroHeading.vue";
</script>

<!-- Left column: headline, description and the district filter list. -->
<template>
  <section class="hero" aria-label="Overview">
    <HeroHeading />
    <DistrictList />
  </section>
</template>

<style scoped>
.hero {
  position: absolute;
  top: var(--content-top);
  left: var(--gutter);
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  pointer-events: none;
}

.hero > * {
  pointer-events: auto;
}
</style>
