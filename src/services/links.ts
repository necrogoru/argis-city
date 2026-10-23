import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauri } from "./isTauri";

/** Opens a terminal link in the default browser; the browser mock uses a new tab. */
export function openExternalUrl(url: string): void {
  if (isTauri()) {
    void openUrl(url).catch((error: unknown) => console.error("[argis] could not open link", error));
    return;
  }
  window.open(url, "_blank", "noopener");
}
