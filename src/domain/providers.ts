import type { ProviderId } from "./types";
import { PALETTE, type PaletteColor } from "./palette";

/** Position of a provider's tower on the 2×2 city diamond. */
export type TowerSlot = "back" | "left" | "front" | "right";

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  color: PaletteColor;
  hex: string;
  slot: TowerSlot;
}

/** Display order for lists (matches the diamond: back, left, front, right). */
export const PROVIDER_ORDER: readonly ProviderId[] = [
  "claude",
  "codex",
  "opencode",
  "pi",
];

function meta(
  id: ProviderId,
  label: string,
  color: PaletteColor,
  slot: TowerSlot,
): ProviderMeta {
  return { id, label, color, hex: PALETTE[color], slot };
}

export const PROVIDERS: Readonly<Record<ProviderId, ProviderMeta>> = {
  claude: meta("claude", "Claude Code", "teal", "back"),
  codex: meta("codex", "Codex", "blue", "left"),
  opencode: meta("opencode", "OpenCode", "amber", "front"),
  pi: meta("pi", "Pi", "violet", "right"),
};

export function providerMeta(id: ProviderId): ProviderMeta {
  return PROVIDERS[id];
}
