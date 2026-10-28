<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import type { TaskImage } from "../../domain/types";
import { useAgentSource } from "../../composables/useAgentSource";

const props = defineProps<{ image: TaskImage }>();
const emit = defineEmits<{ loaded: [blob: Blob] }>();
const source = useAgentSource();
const url = ref<string | null>(null);
const failed = ref(false);

onMounted(async () => {
  try {
    const bytes = await source.readTaskImage(props.image.id);
    const blob = new Blob([bytes], { type: props.image.mimeType });
    url.value = URL.createObjectURL(blob);
    emit("loaded", blob);
  } catch {
    failed.value = true;
  }
});

onBeforeUnmount(() => {
  if (url.value) URL.revokeObjectURL(url.value);
  url.value = null;
});
</script>

<template>
  <img v-if="url" class="task-image-preview" :src="url" :alt="props.image.fileName" />
  <span
    v-else
    class="task-image-placeholder"
    role="img"
    :aria-label="failed ? `${props.image.fileName} could not be loaded` : `Loading ${props.image.fileName}`"
  >
    {{ failed ? "Unavailable" : "Loading…" }}
  </span>
</template>

<style scoped>
.task-image-preview,
.task-image-placeholder {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: contain;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--fill-subtle);
}

.task-image-placeholder {
  display: grid;
  min-height: 96px;
  place-items: center;
  color: var(--text-3);
  font-size: 12px;
}
</style>
