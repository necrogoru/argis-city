export function fullTerminalRefreshRange(rows: number): readonly [number, number] | null {
  if (!Number.isInteger(rows) || rows < 1) return null;
  return [0, rows - 1];
}
