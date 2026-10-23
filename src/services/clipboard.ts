import { writeText } from "@tauri-apps/plugin-clipboard-manager";
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
