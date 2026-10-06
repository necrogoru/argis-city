import { describe, expect, it } from "vitest";
import tresSource from "@tresjs/core?raw";

// TresCanvas registers a devtools bridge in every build: two rAF loops that run each vsync
// and traverse the scene even while the render loop is parked, roughly tripling the idle
// CPU floor. Nothing can attach Vue devtools to the Tauri webview, so a pnpm patch drops it.
describe("@tresjs/core devtools patch", () => {
  it("leaves TresCanvas without the devtools registration", () => {
    expect(tresSource).toContain("TresCanvas");
    expect(tresSource).not.toMatch(/registerTresDevtools\(ctx\?\.app/);
  });
});
