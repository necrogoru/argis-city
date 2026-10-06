<script setup lang="ts">
import { useEffectComposer } from "../composables/useEffectComposer";

useEffectComposer();
</script>

<!-- FXAA + Bloom post-processing; renders nothing itself. -->
<template>
  <slot />
</template>
