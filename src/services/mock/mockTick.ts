/** Advances the mock city one poll tick. Pure given `rnd`. */
import type {
  AgentSession,
  AgentStatus,
  ProviderId,
  ProviderSummary,
  Snapshot,
  SubAgent,
} from "../../domain/types";
import { PROVIDER_ORDER } from "../../domain/providers";
import { deriveProgress, type Plan } from "./mockFactory";
import { STEP_LINES } from "./mockSeed";

type Rnd = () => number;

interface Agentish {
  status: AgentStatus;
  tokens: AgentSession["tokens"];
  progress: AgentSession["progress"];
}

function planOf(item: Agentish): Plan | null {
  const { completedSteps: done, totalSteps: total } = item.progress;
  return item.progress.source === "plan" && done != null && total ? [done, total] : null;
}

function nextStatus(status: AgentStatus, plan: Plan | null, isSub: boolean, rnd: Rnd): AgentStatus {
  if (status === "running" && plan && plan[0] >= plan[1]) return isSub ? "done" : "idle";
  if (status === "running" && !isSub && rnd() < 0.02) return "awaitingApproval";
  if (status === "awaitingApproval" && rnd() < (isSub ? 0.18 : 0.05)) return "running";
  if (status === "idle" && rnd() < (isSub ? 0.06 : 0.04)) return "running";
  if (status === "done" && isSub && plan && rnd() < 0.03) return "running";
  return status;
}

function advance<T extends Agentish & { updatedAt: number }>(item: T, now: number, isSub: boolean, rnd: Rnd): T {
  let plan = planOf(item);
  if (item.status === "running" && plan && rnd() < 0.12) plan = [Math.min(plan[0] + 1, plan[1]), plan[1]];
  const status = nextStatus(item.status, plan, isSub, rnd);
  if (status === "running" && item.status !== "running" && plan && plan[0] >= plan[1]) {
    plan = [0, plan[1]]; // a fresh task after finishing the last one
  }
  if (status === item.status && status !== "running") return item;

  const burn = status === "running" ? Math.round(600 + rnd() * 4_800) : 0;
  const { contextUsed, contextWindow } = item.tokens;
  const tokens = {
    ...item.tokens,
    output: item.tokens.output + Math.round(burn * 0.3),
    input: item.tokens.input + Math.round(burn * 0.7),
    total: item.tokens.total + burn,
    contextUsed:
      contextUsed == null || !contextWindow ? contextUsed : Math.min(contextUsed + burn * 0.5, contextWindow * 0.96),
  };
  return {
    ...item,
    status,
    tokens,
    progress: deriveProgress(status, plan, tokens),
    updatedAt: status === "done" ? item.updatedAt : now,
  };
}

function tickSession(session: AgentSession, now: number, rnd: Rnd): AgentSession {
  const next = advance(session, now, false, rnd);
  const subagents = session.subagents.map((s) => advance<SubAgent>(s, now, true, rnd));
  const restarted = subagents.map((s, i) =>
    s.status === "running" && session.subagents[i].status === "done" ? { ...s, startedAt: now } : s,
  );
  const currentStep =
    next.status === "running" && rnd() < 0.2
      ? STEP_LINES[Math.floor(rnd() * STEP_LINES.length)]
      : next.currentStep;
  const changed = next !== session || restarted.some((s, i) => s !== session.subagents[i]);
  return changed ? { ...next, subagents: restarted, currentStep } : session;
}

export function providerSummaries(
  sessions: AgentSession[],
  missing: readonly ProviderId[] = [],
): ProviderSummary[] {
  return PROVIDER_ORDER.map((provider) => ({
    provider,
    available: !missing.includes(provider),
    sessionCount: sessions.filter((s) => s.provider === provider).length,
    error: null,
  }));
}

/** Every FLIP_EVERY ticks one session (round-robin) changes status, for demos. */
export const FLIP_EVERY = 3;
const AFTER_RUNNING: readonly AgentStatus[] = ["awaitingApproval", "done", "awaitingApproval", "error"];

export function flipStatus(status: AgentStatus, variant: number): AgentStatus {
  switch (status) {
    case "running":
      return AFTER_RUNNING[variant % AFTER_RUNNING.length];
    case "done":
    case "error":
      return "idle";
    default:
      return "running";
  }
}

function flipSession(session: AgentSession, now: number, variant: number): AgentSession {
  const status = flipStatus(session.status, variant);
  const plan = planOf(session);
  const nextPlan: Plan | null = plan && status === "done" ? [plan[1], plan[1]] : plan;
  return { ...session, status, progress: deriveProgress(status, nextPlan, session.tokens), updatedAt: now };
}

export function tickSnapshot(snapshot: Snapshot, now: number, rnd: Rnd, tick = 0): Snapshot {
  const ticked = snapshot.sessions.map((s) => tickSession(s, now, rnd));
  const flips = tick > 0 && tick % FLIP_EVERY === 0 ? tick / FLIP_EVERY : 0;
  const target = flips > 0 && ticked.length > 0 ? (flips * 5) % ticked.length : -1;
  const sessions = ticked.map((s, i) => (i === target ? flipSession(s, now, flips) : s));
  const missing = snapshot.providers.filter((p) => !p.available).map((p) => p.provider);
  return { generatedAt: now, sessions, providers: providerSummaries(sessions, missing) };
}
