import type { TaskImage, TaskImageInput, TaskImageMimeType } from "./types";

export const TASK_IMAGE_MIME_TYPES: readonly TaskImageMimeType[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

export const MAX_TASK_IMAGES = 12;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_TASK_IMAGE_BYTES = 30 * 1024 * 1024;

const MEGABYTE = 1024 * 1024;
const BASE64_CHUNK_BYTES = 0x8000;

function matchesAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}

/** Mirrors the Rust magic-byte sniff so the browser mock rejects the same files. */
export function sniffImageMimeType(bytes: Uint8Array): TaskImageMimeType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (matchesAscii(bytes, 0, "GIF87a") || matchesAscii(bytes, 0, "GIF89a")) return "image/gif";
  if (matchesAscii(bytes, 0, "RIFF") && matchesAscii(bytes, 8, "WEBP")) return "image/webp";
  return null;
}

/**
 * Checks the set that would survive the save. `kept` excludes images the user
 * detached, so removing one at the cap frees room for one addition.
 */
export function validateTaskImages(
  kept: readonly { byteSize: number }[],
  added: readonly { fileName: string; byteSize: number }[],
): string | null {
  if (kept.length + added.length > MAX_TASK_IMAGES) {
    return `A task can hold at most ${MAX_TASK_IMAGES} images.`;
  }
  for (const image of added) {
    if (image.byteSize > MAX_IMAGE_BYTES) {
      return `${image.fileName} is larger than ${MAX_IMAGE_BYTES / MEGABYTE} MB.`;
    }
  }
  const total = [...kept, ...added].reduce((sum, image) => sum + image.byteSize, 0);
  if (total > MAX_TASK_IMAGE_BYTES) {
    return `Attached images would exceed ${MAX_TASK_IMAGE_BYTES / MEGABYTE} MB.`;
  }
  return null;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_BYTES) {
    binary += String.fromCharCode(...bytes.subarray(index, index + BASE64_CHUNK_BYTES));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

/** Builds the wire payload: kept images in display order, then new ones. */
export function buildTaskImageInputs(
  existing: readonly TaskImage[],
  keptIds: readonly number[],
  added: readonly { fileName: string; mimeType: TaskImageMimeType; dataBase64: string }[],
): TaskImageInput[] {
  const kept = existing
    .filter((image) => keptIds.includes(image.id))
    .map((image) => ({
      imageId: image.id,
      fileName: image.fileName,
      mimeType: image.mimeType,
      dataBase64: null,
    }));
  const staged = added.map((image) => ({
    imageId: null,
    fileName: image.fileName,
    mimeType: image.mimeType,
    dataBase64: image.dataBase64,
  }));
  return [...kept, ...staged];
}
