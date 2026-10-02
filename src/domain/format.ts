/** Pure display formatters. */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** `842`, `148.2K`, `2.41M`, `1.20B`. */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1_000) return String(Math.round(n));
  const k = Math.round(n / 100) / 10;
  if (k < 1_000) return `${k.toFixed(1)}K`;
  const m = Math.round(n / 10_000) / 100;
  if (m < 1_000) return `${m.toFixed(2)}M`;
  return `${(n / 1e9).toFixed(2)}B`;
}

/** Compact size without trailing zeros, for context windows: `200K`, `1M`. */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  const trim = (v: number, digits: number) => String(Number(v.toFixed(digits)));
  if (n < 1_000) return String(Math.round(n));
  if (n < 1_000_000) return `${trim(n / 1e3, 1)}K`;
  return `${trim(n / 1e6, 2)}M`;
}

/** `00:05`, `42:17`, `1:02:05`. Negative durations clamp to zero. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

/** Local wall-clock time `HH:MM` for an epoch-ms timestamp. */
export function formatClock(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** `68%`, or an em dash when unknown. */
export function formatPercent(percent: number | null): string {
  return percent == null ? "—" : `${Math.round(percent)}%`;
}

/** Two-digit house number: `3` → `03`. */
export function formatHouseNumber(n: number): string {
  return pad2(n);
}

/** Replace the home-directory prefix with `~`. */
export function tildify(path: string): string {
  return path.replace(/^(\/Users|\/home)\/[^/]+(?=\/|$)/, "~");
}

/** Truncate to `max` visible characters with a single-character ellipsis. */
export function truncateLabel(text: string, max = 18): string {
  const chars = Array.from(text.trim());
  if (chars.length <= max) return chars.join("");
  return `${chars.slice(0, Math.max(1, max - 1)).join("").trimEnd()}…`;
}
