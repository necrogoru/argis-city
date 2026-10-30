import type { TerminalTab } from "./types";

/** Shell slots a task terminal can own, including the base `term` slot. */
export const MAX_SHELL_TABS = 6;

export const AGENT_TAB: TerminalTab = "agent";
export const BASE_SHELL_TAB: TerminalTab = "term";
export const BASE_TERMINAL_TABS: readonly TerminalTab[] = [AGENT_TAB, BASE_SHELL_TAB];

export function isAgentTab(tab: TerminalTab): boolean {
  return tab === "agent";
}

export function isShellTab(tab: TerminalTab): boolean {
  return !isAgentTab(tab);
}

export function shellTab(slot: number): TerminalTab {
  return slot === 1 ? BASE_SHELL_TAB : `term-${slot}`;
}

/** Slot number of a shell tab id, or null when the id is not a supported shell. */
export function shellTabSlot(tab: TerminalTab): number | null {
  if (tab === "agent") return null;
  if (tab === BASE_SHELL_TAB) return 1;
  const suffix = tab.slice("term-".length);
  if (tab !== `term-${suffix}` || suffix.length === 0) return null;
  const slot = Number(suffix);
  if (!Number.isInteger(slot) || slot < 2 || slot > MAX_SHELL_TABS || String(slot) !== suffix) return null;
  return slot;
}

/** Tab label: `Agent`, `term`, then `term 2` and up. */
export function terminalTabLabel(tab: TerminalTab): string {
  if (isAgentTab(tab)) return "Agent";
  const slot = shellTabSlot(tab);
  return slot == null || slot === 1 ? tab : `term ${slot}`;
}

export function sortTerminalTabs(tabs: Iterable<TerminalTab>): TerminalTab[] {
  return [...tabs].sort((left, right) => {
    if (left === right) return 0;
    if (left === AGENT_TAB) return -1;
    if (right === AGENT_TAB) return 1;
    return (shellTabSlot(left) ?? MAX_SHELL_TABS + 1) - (shellTabSlot(right) ?? MAX_SHELL_TABS + 1);
  });
}

/** Lowest free shell slot, or null when every shell slot is taken. */
export function nextShellTab(tabs: readonly TerminalTab[]): TerminalTab | null {
  const used = new Set(tabs.map(shellTabSlot).filter((slot): slot is number => slot != null));
  for (let slot = 1; slot <= MAX_SHELL_TABS; slot += 1) {
    if (!used.has(slot)) return shellTab(slot);
  }
  return null;
}

/** Union of the current tabs and shell tabs reported by the backend, in stable order. */
export function mergeTerminalTabs(current: readonly TerminalTab[], incoming: readonly TerminalTab[]): TerminalTab[] {
  const merged = new Set(current);
  for (const tab of incoming) {
    if (isShellTab(tab) && shellTabSlot(tab) != null) merged.add(tab);
  }
  return sortTerminalTabs(merged);
}
