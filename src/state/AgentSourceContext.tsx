import { createContext, useContext, type ReactNode } from "react";
import type { AgentSource } from "../services/agentSource";

const AgentSourceContext = createContext<AgentSource | null>(null);

export function AgentSourceProvider({ source, children }: { source: AgentSource; children: ReactNode }) {
  return <AgentSourceContext.Provider value={source}>{children}</AgentSourceContext.Provider>;
}

export function useAgentSource(): AgentSource {
  const source = useContext(AgentSourceContext);
  if (!source) throw new Error("useAgentSource must be used inside <AgentSourceProvider>");
  return source;
}
