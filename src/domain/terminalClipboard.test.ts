import { describe, expect, it } from "vitest";
import { osc52ClipboardText } from "./terminalClipboard";

describe("osc52ClipboardText", () => {
  it("decodes the system clipboard selection", () => {
    // "héllo" in UTF-8, base64 encoded.
    expect(osc52ClipboardText("c;aMOpbGxv")).toBe("héllo");
  });

  it("accepts an empty selection and trims the payload", () => {
    expect(osc52ClipboardText("; aGk=")).toBe("hi");
  });

  it("keeps multiline text intact", () => {
    const encoded = btoa("line one\nline two");
    expect(osc52ClipboardText(`c;${encoded}`)).toBe("line one\nline two");
  });

  it("ignores read requests, malformed payloads, and invalid base64", () => {
    expect(osc52ClipboardText("c;?")).toBeNull();
    expect(osc52ClipboardText("c;")).toBeNull();
    expect(osc52ClipboardText("")).toBeNull();
    expect(osc52ClipboardText("no-separator")).toBeNull();
    expect(osc52ClipboardText("c;not base64!")).toBeNull();
  });
});
