/**
 * Wire contract between the Rust backend and the UI.
 * Mirrors `src-tauri/src/domain/*.rs` (serde `rename_all = "camelCase"`).
 * Source of truth: docs/CONTRACT.md — change both sides together.
 */

export type ProviderId = "claude" | "codex" | "opencode" | "pi";

export type AgentStatus =
  | "running"
  | "idle"
  | "awaitingApproval"
  | "done"
  | "error";

export type ProgressSource = "plan" | "context" | "status" | "none";

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** input + output + cacheRead + cacheWrite, accumulated over the session. */
  total: number;
  /** Tokens occupying the context window on the latest turn. */
  contextUsed: number | null;
  contextWindow: number | null;
}

export interface Progress {
  /** 0–100, or null when it cannot be estimated. */
  percent: number | null;
  source: ProgressSource;
  completedSteps: number | null;
  totalSteps: number | null;
}

export interface SubAgent {
  id: string;
  title: string;
  /** e.g. "Explore", "general-purpose"; null when unknown. */
  kind: string | null;
  status: AgentStatus;
  tokens: TokenUsage;
  progress: Progress;
  /** Unix epoch milliseconds. */
  startedAt: number;
  updatedAt: number;
}

export interface AgentSession {
  /** Stable across polls: `${provider}:${nativeSessionId}`. */
  id: string;
  provider: ProviderId;
  title: string;
  cwd: string;
  model: string | null;
  pid: number | null;
  status: AgentStatus;
  tokens: TokenUsage;
  progress: Progress;
  /** Short human summary of what the agent is doing now (≤ 160 chars). */
  currentStep: string | null;
  startedAt: number;
  updatedAt: number;
  subagents: SubAgent[];
}

export interface ProviderSummary {
  provider: ProviderId;
  /** The tool's data directory exists on this machine. */
  available: boolean;
  sessionCount: number;
  error: string | null;
}

export interface Snapshot {
  generatedAt: number;
  sessions: AgentSession[];
  providers: ProviderSummary[];
}

/** Tauri event name the backend emits a `Snapshot` on, every poll tick. */
export const SNAPSHOT_EVENT = "agents://snapshot";
