import { inject, type InjectionKey } from "vue";
import type { AgentSource } from "../services/agentSource";

/** Provided once in `main.ts`: the Tauri backend in the app, the mock in a browser. */
export const agentSourceKey: InjectionKey<AgentSource> = Symbol("agentSource");

export function useAgentSource(): AgentSource {
  const source = inject(agentSourceKey);
  if (!source) throw new Error("useAgentSource: no AgentSource provided (see main.ts)");
  return source;
}
