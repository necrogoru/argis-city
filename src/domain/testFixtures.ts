/** Minimal builders for unit tests (not imported by app code). */
import type { AgentSession, Progress, Snapshot, SubAgent, TokenUsage } from "./types";

export function tokenUsage(total: number, overrides: Partial<TokenUsage> = {}): TokenUsage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total,
    contextUsed: null,
    contextWindow: null,
    ...overrides,
  };
}

export const NO_PROGRESS: Progress = {
  percent: null,
  source: "none",
  completedSteps: null,
  totalSteps: null,
};

export function subagent(overrides: Partial<SubAgent> = {}): SubAgent {
  return {
    id: "sub-1",
    title: "Explore repo",
    kind: "Explore",
    status: "running",
    tokens: tokenUsage(1_000),
    progress: NO_PROGRESS,
    startedAt: 1_000,
    updatedAt: 2_000,
    ...overrides,
  };
}

export function session(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    id: "claude:abc",
    provider: "claude",
    title: "argis",
    cwd: "/Users/dev/argis",
    model: "claude-opus",
    pid: 42,
    status: "running",
    tokens: tokenUsage(10_000),
    progress: NO_PROGRESS,
    currentStep: null,
    startedAt: 1_000,
    updatedAt: 2_000,
    subagents: [],
    ...overrides,
  };
}

export function snapshot(sessions: AgentSession[]): Snapshot {
  return { generatedAt: 5_000, sessions, providers: [] };
}
