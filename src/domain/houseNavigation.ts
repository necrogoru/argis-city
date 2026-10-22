export type HouseCursorDirection = "next" | "previous";

export function formatHouseCursorAnnouncement(providerLabel: string, houseNumber: number, title: string): string {
  return `${providerLabel}, house ${houseNumber}: ${title}`;
}

/** Resolve the next keyboard cursor ID from the stable, displayed house order. */
export function resolveHouseCursorNavigation(
  houseIds: readonly string[],
  direction: HouseCursorDirection,
  cursorId: string | null,
  selectedId: string | null,
): string | null {
  if (houseIds.length === 0) return null;

  const anchorId = cursorId ?? selectedId;
  const anchorIndex = anchorId == null ? -1 : houseIds.indexOf(anchorId);
  if (anchorIndex === -1) return direction === "next" ? houseIds[0] : houseIds[houseIds.length - 1];

  const offset = direction === "next" ? 1 : -1;
  return houseIds[(anchorIndex + offset + houseIds.length) % houseIds.length];
}
