import { writeImage, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isTauri } from "./isTauri";

/**
 * OSC 52 writes arrive from the pty outside a user gesture, where macOS blocks
 * `navigator.clipboard` inside WKWebView; the desktop app writes through the
 * native pasteboard instead. The browser mock keeps the web API.
 */
export async function writeClipboardText(text: string): Promise<void> {
  if (!text) return;
  if (isTauri()) {
    await writeText(text);
    return;
  }
  await navigator.clipboard?.writeText(text);
}

/**
 * Copies PNG pixels so the agent terminal can paste a picture with Ctrl+V.
 * Tauri decodes the bytes through its `image-png` feature; the browser uses the
 * async clipboard API.
 */
export async function writeClipboardImage(pngBytes: Uint8Array): Promise<void> {
  if (isTauri()) {
    await writeImage(pngBytes);
    return;
  }
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Copying images is not available in this browser");
  }
  const png = new Uint8Array(pngBytes);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([png.buffer], { type: "image/png" }) })]);
}
