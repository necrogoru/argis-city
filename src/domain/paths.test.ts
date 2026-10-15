import { describe, expect, it } from "vitest";
import { normalizeAbsolutePath } from "./paths";

describe("normalizeAbsolutePath", () => {
  it("collapses dot segments, duplicate separators, and trailing slashes", () => {
    expect(normalizeAbsolutePath("//Users/dev/./project/branch/../worktree/")).toBe(
      "/Users/dev/project/worktree",
    );
  });

  it("does not compare relative paths as absolute worktrees", () => {
    expect(normalizeAbsolutePath("Users/dev/worktree")).toBeNull();
  });
});
