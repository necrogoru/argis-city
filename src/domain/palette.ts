/**
 * Colour tokens mirrored from `styles/tokens.css`. The WebGL scene cannot read
 * CSS variables, so it uses the hex values; DOM code should prefer `cssVar`.
 */
export const PALETTE = {
  bg: "#0A0B0C",
  teal: "#32F3E2",
  blue: "#67A2FD",
  amber: "#FFB662",
  violet: "#B98CFF",
  grey: "#8E9794",
  red: "#FF6B6B",
} as const;

export type PaletteColor = Exclude<keyof typeof PALETTE, "bg">;

/** CSS custom-property reference for a palette colour, e.g. `var(--teal)`. */
export function cssVar(color: PaletteColor): string {
  return `var(--${color})`;
}
