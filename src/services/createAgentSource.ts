import type { AgentSource } from "./agentSource";
import { createTauriAgentSource } from "./tauriAgentSource";
import { MockAgentSource } from "./mock/mockAgentSource";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Tauri backend inside the desktop app; realistic mock data in a plain browser
 * (`pnpm dev`). `?mock` forces the mock even inside Tauri; `?mock=empty` shows
 * the empty city (no sessions, Pi not installed).
 */
export function createAgentSource(): AgentSource {
  const params = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
  if (isTauri() && !params.has("mock")) return createTauriAgentSource();
  return new MockAgentSource(params.get("mock") === "empty" ? "empty" : "busy");
}
