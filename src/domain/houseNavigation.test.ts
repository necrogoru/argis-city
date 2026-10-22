import { describe, expect, it } from "vitest";
import { formatHouseCursorAnnouncement, resolveHouseCursorNavigation } from "./houseNavigation";

const houseIds = ["claude:a", "claude:b", "codex:c", "pi:d"];

describe("resolveHouseCursorNavigation", () => {
  it("starts at the first or last house when nothing is selected", () => {
    expect(resolveHouseCursorNavigation(houseIds, "next", null, null)).toBe("claude:a");
    expect(resolveHouseCursorNavigation(houseIds, "previous", null, null)).toBe("pi:d");
  });

  it("moves relative to the committed selection without changing it", () => {
    expect(resolveHouseCursorNavigation(houseIds, "next", null, "claude:b")).toBe("codex:c");
    expect(resolveHouseCursorNavigation(houseIds, "previous", null, "codex:c")).toBe("claude:b");
  });

  it("continues from the temporary cursor before the committed selection", () => {
    expect(resolveHouseCursorNavigation(houseIds, "next", "claude:b", "pi:d")).toBe("codex:c");
    expect(resolveHouseCursorNavigation(houseIds, "previous", "codex:c", "pi:d")).toBe("claude:b");
  });

  it("wraps across the ends of the ordered houses", () => {
    expect(resolveHouseCursorNavigation(houseIds, "next", "pi:d", null)).toBe("claude:a");
    expect(resolveHouseCursorNavigation(houseIds, "previous", "claude:a", null)).toBe("pi:d");
  });

  it("falls back to directional initialization when the anchor is not present", () => {
    expect(resolveHouseCursorNavigation(houseIds, "next", "gone", null)).toBe("claude:a");
    expect(resolveHouseCursorNavigation(houseIds, "previous", null, "gone")).toBe("pi:d");
  });

  it("returns null when no houses are available", () => {
    expect(resolveHouseCursorNavigation([], "next", null, null)).toBeNull();
  });
});

describe("formatHouseCursorAnnouncement", () => {
  it("announces the provider, house number, and title", () => {
    expect(formatHouseCursorAnnouncement("Claude Code", 2, "Authentication refactor"))
      .toBe("Claude Code, house 2: Authentication refactor");
  });
});
