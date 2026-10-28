import { describe, expect, it } from "vitest";
import {
  buildTaskImageInputs,
  base64ToBytes,
  bytesToBase64,
  formatByteSize,
  MAX_IMAGE_BYTES,
  sniffImageMimeType,
  validateTaskImages,
} from "./imageFiles";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

describe("task image files", () => {
  it("sniffs png, jpeg, gif, webp, and rejects everything else", () => {
    expect(sniffImageMimeType(png)).toBe("image/png");
    expect(sniffImageMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageMimeType(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(sniffImageMimeType(new TextEncoder().encode("RIFF0000WEBP"))).toBe("image/webp");
    expect(sniffImageMimeType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });

  it("round-trips base64 and formats sizes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    expect(formatByteSize(1536)).toBe("1.5 KB");
    expect(formatByteSize(512)).toBe("512 B");
  });

  it("rejects too many images, oversized images, and an over-budget set", () => {
    const kept = Array.from({ length: 12 }, () => ({ byteSize: 1 }));
    expect(validateTaskImages(kept, [{ fileName: "b.png", byteSize: 1 }])).toContain("12");
    expect(validateTaskImages([], [{ fileName: "big.png", byteSize: MAX_IMAGE_BYTES + 1 }])).toContain("10 MB");
    expect(
      validateTaskImages([], [
        { fileName: "a.png", byteSize: 8 * 1024 * 1024 },
        { fileName: "b.png", byteSize: 8 * 1024 * 1024 },
        { fileName: "c.png", byteSize: 8 * 1024 * 1024 },
        { fileName: "d.png", byteSize: 8 * 1024 * 1024 },
      ]),
    ).toContain("30 MB");
    expect(validateTaskImages(kept.slice(1), [{ fileName: "c.png", byteSize: 1 }])).toBeNull();
  });

  it("builds kept images first and new images last", () => {
    const existing = [{ id: 4, fileName: "keep.png", mimeType: "image/png" as const, byteSize: 2 }];
    expect(
      buildTaskImageInputs(existing, [4], [{ fileName: "new.png", mimeType: "image/png", dataBase64: "AA==" }]),
    ).toEqual([
      { imageId: 4, fileName: "keep.png", mimeType: "image/png", dataBase64: null },
      { imageId: null, fileName: "new.png", mimeType: "image/png", dataBase64: "AA==" },
    ]);
  });
});
