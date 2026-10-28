import { ref, type Ref } from "vue";
import type { TaskImage, TaskImageInput, TaskImageMimeType } from "../domain/types";
import {
  base64ToBytes,
  buildTaskImageInputs,
  bytesToBase64,
  MAX_IMAGE_BYTES,
  sniffImageMimeType,
  validateTaskImages,
} from "../domain/imageFiles";
import { useAgentSource } from "./useAgentSource";

export interface StagedTaskImage {
  fileName: string;
  mimeType: TaskImageMimeType;
  byteSize: number;
  dataBase64: string;
  previewUrl: string;
}

export interface TaskImageAttachments {
  staged: Ref<StagedTaskImage[]>;
  keptIds: Ref<number[]>;
  error: Ref<string | null>;
  dragActive: Ref<boolean>;
  addFiles(files: Iterable<File>, existing: readonly TaskImage[]): Promise<void>;
  addPaths(paths: readonly string[], existing: readonly TaskImage[]): Promise<void>;
  removeStaged(index: number): void;
  removeExisting(imageId: number): void;
  reset(): void;
  inputs(existing: readonly TaskImage[]): TaskImageInput[];
}

const UNSUPPORTED = "Only PNG, JPEG, WebP, and GIF images can be attached.";
const MEGABYTE = 1024 * 1024;

/** Stages image edits in memory; nothing is written until the task is saved. */
export function useTaskImageAttachments(): TaskImageAttachments {
  const source = useAgentSource();
  const staged = ref<StagedTaskImage[]>([]);
  const keptIds = ref<number[]>([]);
  const error = ref<string | null>(null);
  const dragActive = ref(false);

  function budgetProblem(
    existing: readonly TaskImage[],
    candidate: { fileName: string; byteSize: number },
  ): string | null {
    const kept = existing.filter((image) => keptIds.value.includes(image.id));
    return validateTaskImages(kept, [...staged.value, candidate]);
  }

  function stage(file: { fileName: string; mimeType: TaskImageMimeType; byteSize: number; dataBase64: string }, preview: Blob): void {
    staged.value = [
      ...staged.value,
      { ...file, previewUrl: URL.createObjectURL(preview) },
    ];
  }

  async function addFiles(files: Iterable<File>, existing: readonly TaskImage[]): Promise<void> {
    error.value = null;
    for (const file of Array.from(files)) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const fileName = file.name || "image";
      if (bytes.length > MAX_IMAGE_BYTES) {
        error.value = `${fileName} is larger than ${MAX_IMAGE_BYTES / MEGABYTE} MB.`;
        continue;
      }
      const mimeType = sniffImageMimeType(bytes);
      if (!mimeType) {
        error.value = UNSUPPORTED;
        continue;
      }
      const problem = budgetProblem(existing, { fileName, byteSize: bytes.length });
      if (problem) {
        error.value = problem;
        return;
      }
      stage({ fileName, mimeType, byteSize: bytes.length, dataBase64: bytesToBase64(bytes) }, file);
    }
  }

  async function addPaths(paths: readonly string[], existing: readonly TaskImage[]): Promise<void> {
    error.value = null;
    for (const path of paths) {
      try {
        const file = await source.readImageFile(path);
        const bytes = base64ToBytes(file.dataBase64);
        if (bytes.length > MAX_IMAGE_BYTES) {
          error.value = `${file.fileName} is larger than ${MAX_IMAGE_BYTES / MEGABYTE} MB.`;
          continue;
        }
        const problem = budgetProblem(existing, file);
        if (problem) {
          error.value = problem;
          return;
        }
        stage(
          { fileName: file.fileName, mimeType: file.mimeType, byteSize: file.byteSize, dataBase64: file.dataBase64 },
          new Blob([bytes.slice().buffer], { type: file.mimeType }),
        );
      } catch (reason) {
        error.value = reason instanceof Error ? reason.message : String(reason);
      }
    }
  }

  function removeStaged(index: number): void {
    const [removed] = staged.value.slice(index, index + 1);
    if (!removed) return;
    URL.revokeObjectURL(removed.previewUrl);
    staged.value = staged.value.filter((_, candidate) => candidate !== index);
  }

  function removeExisting(imageId: number): void {
    keptIds.value = keptIds.value.filter((id) => id !== imageId);
  }

  function reset(): void {
    for (const image of staged.value) URL.revokeObjectURL(image.previewUrl);
    staged.value = [];
    keptIds.value = [];
    error.value = null;
    dragActive.value = false;
  }

  function inputs(existing: readonly TaskImage[]): TaskImageInput[] {
    return buildTaskImageInputs(existing, keptIds.value, staged.value);
  }

  return { staged, keptIds, error, dragActive, addFiles, addPaths, removeStaged, removeExisting, reset, inputs };
}
