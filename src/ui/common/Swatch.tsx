import type { PaletteColor } from "../../domain/palette";
import { cssVar } from "../../domain/palette";

/** 10px rounded colour swatch identifying a provider. */
export function Swatch({ color, size = 10 }: { color: PaletteColor; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        flex: "none",
        width: size,
        height: size,
        borderRadius: 3,
        background: cssVar(color),
        boxShadow: `0 0 8px color-mix(in srgb, ${cssVar(color)} 55%, transparent)`,
      }}
    />
  );
}
