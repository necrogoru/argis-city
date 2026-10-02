import type { Progress, ProgressSource } from "./types";

export interface ProgressDisplay {
  /** Rounded, clamped 0–100, or null when unknown. */
  percent: number | null;
  /** `68%` or `—`. */
  label: string;
  /** Short caption under the number, e.g. "execution". */
  caption: string;
  /** Optional detail such as "5 of 8 steps". */
  detail: string | null;
}

const CAPTIONS: Readonly<Record<ProgressSource, string>> = {
  plan: "execution",
  context: "of context",
  status: "complete",
  none: "no estimate",
};

export function clampPercent(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function displayProgress(progress: Progress): ProgressDisplay {
  const percent = clampPercent(progress.percent);
  const { completedSteps: done, totalSteps: total } = progress;
  const detail =
    progress.source === "plan" && done != null && total != null
      ? `${done} of ${total} steps`
      : null;
  return {
    percent,
    label: percent == null ? "—" : `${percent}%`,
    caption: CAPTIONS[progress.source],
    detail,
  };
}

/** 0–1 fill ratio for bars and rings; unknown progress renders empty. */
export function progressFraction(progress: Progress): number {
  const percent = clampPercent(progress.percent);
  return percent == null ? 0 : percent / 100;
}
