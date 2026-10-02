/** Builders that turn compact seeds into contract-shaped mock objects. */
import type {
  AgentSession,
  AgentStatus,
  Progress,
  ProviderId,
  SubAgent,
  TokenUsage,
} from "../../domain/types";

export const MINUTE = 60_000;

export type Plan = readonly [completed: number, total: number];

export interface SubagentSeed {
  title: string;
  kind: string;
  status: AgentStatus;
  plan?: Plan;
  startedMinAgo: number;
  tokens: number;
}

export interface SessionSeed {
  provider: ProviderId;
  title: string;
  cwd: string;
  model: string;
  status: AgentStatus;
  plan?: Plan;
  startedMinAgo: number;
  tokens: number;
  context?: readonly [used: number, window: number];
  step: string;
  subagents?: SubagentSeed[];
}

export function tokenUsage(total: number, context?: readonly [number, number]): TokenUsage {
  const input = Math.round(total * 0.16);
  const output = Math.round(total * 0.06);
  const cacheWrite = Math.round(total * 0.05);
  return {
    input,
    output,
    cacheRead: total - input - output - cacheWrite,
    cacheWrite,
    total,
    contextUsed: context ? context[0] : null,
    contextWindow: context ? context[1] : null,
  };
}

/** Contract order: plan → status(done) → context → none. */
export function deriveProgress(
  status: AgentStatus,
  plan: Plan | null,
  tokens: TokenUsage,
): Progress {
  if (plan) {
    const [done, total] = plan;
    return { percent: (done / total) * 100, source: "plan", completedSteps: done, totalSteps: total };
  }
  if (status === "done") {
    return { percent: 100, source: "status", completedSteps: null, totalSteps: null };
  }
  if (tokens.contextUsed != null && tokens.contextWindow) {
    const percent = (tokens.contextUsed / tokens.contextWindow) * 100;
    return { percent, source: "context", completedSteps: null, totalSteps: null };
  }
  return { percent: null, source: "none", completedSteps: null, totalSteps: null };
}

function buildSubagent(parentId: string, index: number, seed: SubagentSeed, now: number): SubAgent {
  const tokens = tokenUsage(seed.tokens);
  const startedAt = now - seed.startedMinAgo * MINUTE;
  return {
    id: `${parentId}/agent-${index + 1}`,
    title: seed.title,
    kind: seed.kind,
    status: seed.status,
    tokens,
    progress: deriveProgress(seed.status, seed.plan ?? null, tokens),
    startedAt,
    updatedAt: seed.status === "done" ? startedAt + seed.startedMinAgo * MINUTE * 0.6 : now,
  };
}

export function buildSession(seed: SessionSeed, index: number, now: number): AgentSession {
  const id = `${seed.provider}:mock-${index.toString(16).padStart(4, "0")}`;
  const tokens = tokenUsage(seed.tokens, seed.context);
  return {
    id,
    provider: seed.provider,
    title: seed.title,
    cwd: seed.cwd,
    model: seed.model,
    pid: 40_000 + index * 137,
    status: seed.status,
    tokens,
    progress: deriveProgress(seed.status, seed.plan ?? null, tokens),
    currentStep: seed.step,
    startedAt: now - seed.startedMinAgo * MINUTE,
    updatedAt: now,
    subagents: (seed.subagents ?? []).map((s, i) => buildSubagent(id, i, s, now)),
  };
}
