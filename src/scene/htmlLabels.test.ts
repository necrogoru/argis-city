import { describe, expect, it } from "vitest";

const components = import.meta.glob<string>("./**/*.vue", { query: "?raw", import: "default", eager: true });
const htmlTags = Object.entries(components).flatMap(([file, source]) =>
  [...source.matchAll(/<Html\b[^>]*>/g)].map(([tag]) => ({ file, tag })),
);

// cientos's <Html> wraps its slot in a `pointer-events: auto` div that keeps its
// untransformed box at the anchor (right of and below it) while the label is
// translated up and left: an invisible click-catcher over the houses next to it.
describe("in-scene Html labels", () => {
  it("exist", () => {
    expect(htmlTags.length).toBeGreaterThan(0);
  });

  it.each(htmlTags)("$file opts its wrapper out of pointer events", ({ tag }) => {
    expect(tag).toContain('pointer-events="none"');
  });
});
