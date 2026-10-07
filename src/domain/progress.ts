import type { Progress, ProgressSource } from "./types";

export interface ProgressDisplay {
  /** Rounded, clamped 0–100 of real progress (plan or status), or null. */
  percent: number | null;
  /** Ring value: `68%`, or `—` when there is no real progress. */
  label: string;
  /** Short caption under the ring value, e.g. "execution". */
  caption: string;
  /** Optional detail such as "5 of 8 steps". */
  detail: string | null;
  /** One-token readout for rows and callouts: `68%`, `ctx 74%` (context fill, not progress) or `—`. */
  short: string;
}

const CAPTIONS: Readonly<Record<ProgressSource, string>> = {
  plan: "execution",
  context: "no plan",
  status: "complete",
  none: "no estimate",
};

/**
 * The `context` fallback is context-window fill, not progress: a session at 92 %
 * is about to compact, not nearly done. It never fills a ring or bar, and its
 * short readout says `ctx`.
 */
function isProgress(source: ProgressSource): boolean {
  return source === "plan" || source === "status";
}

export function clampPercent(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function displayProgress(progress: Progress): ProgressDisplay {
  const raw = clampPercent(progress.percent);
  const percent = isProgress(progress.source) ? raw : null;
  const { completedSteps: done, totalSteps: total } = progress;
  const detail =
    progress.source === "plan" && done != null && total != null
      ? `${done} of ${total} steps`
      : null;
  const label = percent == null ? "—" : `${percent}%`;
  return {
    percent,
    label,
    caption: CAPTIONS[progress.source],
    detail,
    short: progress.source === "context" && raw != null ? `ctx ${raw}%` : label,
  };
}

/** 0–1 fill ratio for bars and rings; unknown progress and context fill render empty. */
export function progressFraction(progress: Progress): number {
  const percent = displayProgress(progress).percent;
  return percent == null ? 0 : percent / 100;
}
