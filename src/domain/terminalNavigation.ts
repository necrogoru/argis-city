import type { TerminalTab } from "./types";

type TerminalNavigationKey = Pick<KeyboardEvent, "key" | "ctrlKey">
  & Partial<Pick<KeyboardEvent, "altKey" | "metaKey">>;

export function getTerminalTabForKey(
  activeTab: TerminalTab,
  event: TerminalNavigationKey,
): TerminalTab | null {
  if (event.key === "Tab" && event.ctrlKey && !event.altKey && !event.metaKey) {
    return activeTab === "agent" ? "term" : "agent";
  }

  if (event.key === "Home") return "agent";
  if (event.key === "End") return "term";
  if (event.key === "ArrowLeft" && activeTab === "term") return "agent";
  if (event.key === "ArrowRight" && activeTab === "agent") return "term";
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") return activeTab;
  return null;
}
