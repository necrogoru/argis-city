/**
 * Terminal programs (OpenCode among them) copy by emitting OSC 52 with
 * `<selection>;<base64>`. Writes are honoured; read requests (`?`) and anything
 * unparseable are dropped so a program can never read the clipboard.
 */
export function osc52ClipboardText(payload: string): string | null {
  const separator = payload.indexOf(";");
  if (separator === -1) return null;

  const encoded = payload.slice(separator + 1).trim();
  if (!encoded || encoded === "?") return null;

  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
