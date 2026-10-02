import { describe, expect, it } from "vitest";
import { buildCity } from "./cityModel";
import { session, snapshot } from "../domain/testFixtures";

describe("buildCity", () => {
  it("always renders all four districts, even without data", () => {
    const city = buildCity(null);
    expect(city.districts.map((d) => d.provider)).toEqual(["claude", "codex", "opencode", "pi"]);
    expect(city.districts.every((d) => d.state === "empty" && d.houses.length === 0)).toBe(true);
  });

  it("numbers houses per district and marks unavailable providers", () => {
    const snap = {
      ...snapshot([
        session({ id: "claude:b", startedAt: 20 }),
        session({ id: "claude:a", startedAt: 10 }),
        session({ id: "codex:c", provider: "codex" }),
      ]),
      providers: [{ provider: "pi" as const, available: false, sessionCount: 0, error: null }],
    };
    const city = buildCity(snap);
    const [claude, codex, opencode, pi] = city.districts;
    expect(claude.houses.map((h) => [h.session.id, h.number])).toEqual([
      ["claude:a", 1],
      ["claude:b", 2],
    ]);
    expect(claude.height).toBeGreaterThan(codex.height);
    expect(claude.state).toBe("live");
    expect(opencode.state).toBe("empty");
    expect(pi.state).toBe("unavailable");
  });
});
