import { describe, expect, it } from "vitest";
import { PALETTE } from "./palette";
import { STATUS_ORDER, statusHex, statusMeta, statusRank } from "./status";

describe("statusMeta", () => {
  it("matches the SPEC status table", () => {
    expect(statusMeta("running")).toMatchObject({ label: "Running", color: "teal", icon: "loader" });
    expect(statusMeta("awaitingApproval")).toMatchObject({ label: "Needs approval", color: "amber", icon: "hand" });
    expect(statusMeta("idle")).toMatchObject({ label: "Idle", color: "grey", icon: "moon" });
    expect(statusMeta("done")).toMatchObject({ label: "Done", color: "blue", icon: "check" });
    expect(statusMeta("error")).toMatchObject({ label: "Error", color: "red", icon: "alert" });
  });

  it("uses the short 'Needs you' label for filter chips", () => {
    expect(statusMeta("awaitingApproval").chipLabel).toBe("Needs you");
    expect(statusMeta("running").chipLabel).toBe("Running");
  });
});

describe("shared status colours", () => {
  it("resolves the brief's hex table", () => {
    expect(statusHex("running")).toBe(PALETTE.teal);
    expect(statusHex("awaitingApproval")).toBe("#FFB662");
    expect(statusHex("idle")).toBe("#8E9794");
    expect(statusHex("done")).toBe("#67A2FD");
    expect(statusHex("error")).toBe("#FF6B6B");
  });
});

describe("statusRank", () => {
  it("puts 'needs you' first, then errors, and done last", () => {
    expect(STATUS_ORDER[0]).toBe("awaitingApproval");
    expect(statusRank("awaitingApproval")).toBeLessThan(statusRank("error"));
    expect(statusRank("error")).toBeLessThan(statusRank("running"));
    expect(statusRank("running")).toBeLessThan(statusRank("idle"));
    expect(statusRank("idle")).toBeLessThan(statusRank("done"));
  });
});
