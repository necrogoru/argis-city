import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatCompact,
  formatElapsed,
  formatHouseNumber,
  formatPercent,
  formatTokens,
  tildify,
  truncateLabel,
} from "./format";

describe("formatTokens", () => {
  it.each([
    [0, "0"],
    [-5, "0"],
    [842, "842"],
    [1_000, "1.0K"],
    [148_230, "148.2K"],
    [999_950, "1.00M"],
    [2_410_000, "2.41M"],
    [1_204_000_000, "1.20B"],
  ])("%d → %s", (n, expected) => {
    expect(formatTokens(n)).toBe(expected);
  });
});

describe("formatCompact", () => {
  it("drops trailing zeros", () => {
    expect(formatCompact(200_000)).toBe("200K");
    expect(formatCompact(1_000_000)).toBe("1M");
    expect(formatCompact(128_500)).toBe("128.5K");
    expect(formatCompact(272_000)).toBe("272K");
  });
});

describe("formatElapsed", () => {
  it("uses mm:ss under an hour", () => {
    expect(formatElapsed(5_000)).toBe("00:05");
    expect(formatElapsed((42 * 60 + 17) * 1000)).toBe("42:17");
  });
  it("uses h:mm:ss from an hour", () => {
    expect(formatElapsed((3600 + 2 * 60 + 5) * 1000)).toBe("1:02:05");
  });
  it("clamps negatives and floors fractions", () => {
    expect(formatElapsed(-3_000)).toBe("00:00");
    expect(formatElapsed(1_999)).toBe("00:01");
  });
});

describe("formatClock", () => {
  it("formats local HH:MM", () => {
    expect(formatClock(new Date(2026, 0, 1, 10, 21).getTime())).toBe("10:21");
    expect(formatClock(new Date(2026, 0, 1, 7, 5).getTime())).toBe("07:05");
  });
});

describe("small formatters", () => {
  it("formats percent and house numbers", () => {
    expect(formatPercent(67.6)).toBe("68%");
    expect(formatPercent(null)).toBe("—");
    expect(formatHouseNumber(3)).toBe("03");
    expect(formatHouseNumber(12)).toBe("12");
  });
  it("tildifies home paths only", () => {
    expect(tildify("/Users/dev/Sites/argis")).toBe("~/Sites/argis");
    expect(tildify("/home/dev")).toBe("~");
    expect(tildify("/opt/Users/x")).toBe("/opt/Users/x");
  });
});

describe("truncateLabel", () => {
  it("keeps short titles intact (trimmed)", () => {
    expect(truncateLabel("argis")).toBe("argis");
    expect(truncateLabel("  docs-site ")).toBe("docs-site");
    expect(truncateLabel("exactly-18-chars!!")).toBe("exactly-18-chars!!");
  });

  it("cuts long titles to 18 visible characters ending in an ellipsis", () => {
    const out = truncateLabel("billing-service · webhook retries");
    expect(Array.from(out)).toHaveLength(18);
    expect(out.endsWith("…")).toBe(true);
  });

  it("does not leave a trailing space before the ellipsis", () => {
    expect(truncateLabel("Migrate payments to Stripe v3")).toBe("Migrate payments…");
  });

  it("counts emoji / astral characters as one", () => {
    expect(Array.from(truncateLabel("🚀".repeat(30), 10))).toHaveLength(10);
  });
});
