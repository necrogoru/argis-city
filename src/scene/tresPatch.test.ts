import { describe, expect, it } from "vitest";
import tresSource from "@tresjs/core?raw";

// patches/@tresjs__core@5.9.2.patch — keep these in step with the patch file.
describe("@tresjs/core patch", () => {
  // TresCanvas registers a devtools bridge in every build: two rAF loops that run each vsync
  // and traverse the scene even while the render loop is parked, roughly tripling the idle
  // CPU floor. Nothing can attach Vue devtools to the Tauri webview, so the patch drops it.
  it("leaves TresCanvas without the devtools registration", () => {
    expect(tresSource).toContain("TresCanvas");
    expect(tresSource).not.toMatch(/registerTresDevtools\(ctx\?\.app/);
  });

  // Batched pointer events wait for the next rendered frame, which the frame driver parks
  // between frames; processed at once (as React Three Fiber did), hover reacts within a vsync
  // and a pointer move renders nothing unless what is under the pointer changes.
  it("raycasts canvas pointer events as they arrive instead of batching them per frame", () => {
    expect(tresSource).toMatch(/forwardHtmlEvents\([^;]*\{ batchEvents: false \}\)/);
  });
});
