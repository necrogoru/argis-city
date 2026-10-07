import type { AgentStatus } from "./types";
import { PALETTE, type PaletteColor } from "./palette";

export type StatusIcon = "loader" | "hand" | "moon" | "check" | "alert";

export interface StatusMeta {
  /** Pill label, e.g. "Needs approval". */
  label: string;
  /** Short filter-chip label, e.g. "Needs you". */
  chipLabel: string;
  color: PaletteColor;
  icon: StatusIcon;
}

/** Single source of truth for status colours: pills, list dots, labels, houses. */
export const STATUS_META: Readonly<Record<AgentStatus, StatusMeta>> = {
  running: { label: "Running", chipLabel: "Running", color: "teal", icon: "loader" },
  awaitingApproval: { label: "Needs approval", chipLabel: "Needs you", color: "amber", icon: "hand" },
  idle: { label: "Idle", chipLabel: "Idle", color: "grey", icon: "moon" },
  done: { label: "Done", chipLabel: "Done", color: "blue", icon: "check" },
  error: { label: "Error", chipLabel: "Error", color: "red", icon: "alert" },
};

/** Display order: what needs the user first (approval, then a failed turn), finished last. */
export const STATUS_ORDER: readonly AgentStatus[] = [
  "awaitingApproval",
  "error",
  "running",
  "idle",
  "done",
];

export function statusMeta(status: AgentStatus): StatusMeta {
  return STATUS_META[status];
}

export function statusHex(status: AgentStatus): string {
  return PALETTE[STATUS_META[status].color];
}

/** 0 = most urgent; used to sort lists. */
export function statusRank(status: AgentStatus): number {
  return STATUS_ORDER.indexOf(status);
}
