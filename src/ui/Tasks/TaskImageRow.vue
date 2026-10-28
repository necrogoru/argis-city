<script setup lang="ts">
import { ref } from "vue";
import type { TaskImage } from "../../domain/types";
import { formatByteSize } from "../../domain/imageFiles";
import { writeClipboardImage } from "../../services/clipboard";
import { toPngBytes } from "../../services/imagePng";
import CopyButton from "../common/CopyButton.vue";
import TaskImagePreview from "./TaskImagePreview.vue";

const props = defineProps<{ image: TaskImage }>();
const blob = ref<Blob | null>(null);

async function copyImage(): Promise<void> {
  if (!blob.value) throw new Error("The image is still loading");
  await writeClipboardImage(await toPngBytes(blob.value));
}
</script>

<template>
  <figure class="task-image-row">
    <TaskImagePreview :image="props.image" @loaded="blob = $event" />
    <figcaption class="task-image-meta">
      <span class="task-image-name">{{ props.image.fileName }}</span>
      <span class="task-image-size">{{ formatByteSize(props.image.byteSize) }}</span>
      <CopyButton label="Copy image" copied-label="Image copied" :copy="copyImage" />
    </figcaption>
  </figure>
</template>

<style scoped>
.task-image-row {
  display: grid;
  gap: 10px;
  margin: 0;
}

.task-image-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.task-image-name {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-image-size {
  flex: none;
  color: var(--text-3);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.task-image-meta :deep(.copy) {
  margin-left: auto;
}
</style>
