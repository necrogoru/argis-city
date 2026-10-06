<script setup lang="ts">
import { useCameraRigStore } from "../stores/cameraRig";
import { CAMERA_COMMANDS } from "./cameraCommands";
import IconButton from "./common/IconButton.vue";

const rig = useCameraRigStore();
</script>

<!-- 44px round glass buttons, bottom-left above the subagent strip. -->
<template>
  <div class="controls" role="toolbar" aria-label="Camera">
    <IconButton
      v-for="command in CAMERA_COMMANDS"
      :key="command.label"
      :label="command.label"
      shape="round"
      :size="44"
      @click="command.run(rig)"
    >
      <component :is="command.Icon" :size="18" aria-hidden="true" />
    </IconButton>
  </div>
</template>

<style scoped>
.controls {
  position: absolute;
  left: var(--gutter);
  bottom: calc(var(--gutter) + var(--strip-space, 0px));
  display: flex;
  gap: 8px;
  pointer-events: auto;
  transition: bottom 260ms var(--ease-out);
}
</style>
