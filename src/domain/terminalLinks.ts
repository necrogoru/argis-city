/**
 * Plain clicks belong to the agent running in the terminal (OpenCode tracks the
 * mouse), so only Cmd+Shift+click opens a link the way Terminal.app does.
 */
export function shouldOpenTerminalLink(event: Pick<MouseEvent, "metaKey" | "shiftKey">): boolean {
  return event.metaKey && event.shiftKey;
}
