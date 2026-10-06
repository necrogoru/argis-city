<script setup lang="ts">
const SHADOW_EXTENT = 26;
</script>

<!-- Low ambient fill + one cool key light casting soft shadows across the city. -->
<template>
  <TresAmbientLight :intensity="0.35" />
  <TresHemisphereLight :args="['#2A3A3C', '#050606', 0.6]" />
  <TresDirectionalLight
    :position="[-12, 22, 9]"
    :intensity="1.4"
    color="#DCEBFF"
    cast-shadow
    :shadow-mapSize-width="2048"
    :shadow-mapSize-height="2048"
    :shadow-bias="-0.0004"
    :shadow-normalBias="0.02"
    :shadow-camera-left="-SHADOW_EXTENT"
    :shadow-camera-right="SHADOW_EXTENT"
    :shadow-camera-top="SHADOW_EXTENT"
    :shadow-camera-bottom="-SHADOW_EXTENT"
    :shadow-camera-near="1"
    :shadow-camera-far="80"
  />
  <!-- Faint teal bounce from the city centre. -->
  <TresDirectionalLight :position="[10, 6, 12]" :intensity="0.25" color="#32F3E2" />
</template>
