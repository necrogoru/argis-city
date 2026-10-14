import { computed, ref, shallowRef } from "vue";
import type {
  TerminalAgent,
  TerminalAttachment,
  TerminalEvent,
  TerminalSize,
  TerminalTab,
} from "../../domain/types";
import type { AgentSource } from "../../services/agentSource";

export type TerminalStatus = "notStarted" | "starting" | "running" | "exited" | "error";

export type TerminalSessionService = Pick<
  AgentSource,
  | "startTerminalSession"
  | "reattachTerminalSession"
  | "sendTerminalInput"
  | "resizeTerminalSession"
  | "detachTerminalSession"
>;

interface TerminalSessionOptions {
  source: TerminalSessionService;
  taskId: number;
  tab: TerminalTab;
  getSize: () => TerminalSize | null;
  write: (bytes: Uint8Array) => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useTerminalSession(options: TerminalSessionOptions) {
  const attachment = shallowRef<TerminalAttachment | null>(null);
  const status = ref<TerminalStatus>("notStarted");
  const error = ref<string | null>(null);
  const connected = computed(() => status.value === "running");
  let generation = 0;
  let disposed = false;

  function isCurrent(operation: number): boolean {
    return !disposed && operation === generation;
  }

  function receive(operation: number, event: TerminalEvent): void {
    if (!isCurrent(operation)) return;
    if (attachment.value && event.sessionId !== attachment.value.session.id) return;

    switch (event.type) {
      case "output":
        status.value = "running";
        options.write(Uint8Array.from(event.bytes));
        break;
      case "error":
        status.value = "error";
        error.value = event.message;
        break;
      case "exited":
        status.value = "exited";
        error.value = null;
        break;
    }
  }

  async function detachRemote(current: TerminalAttachment): Promise<void> {
    try {
      await options.source.detachTerminalSession(options.taskId, options.tab, current.attachmentId);
    } catch {
      // The process remains manager-owned; a later reattach replaces the channel.
    }
  }

  function acceptAttachment(result: TerminalAttachment): void {
    attachment.value = result;
    if (status.value === "starting") status.value = result.session.running ? "running" : "exited";
  }

  async function start(agentCli: TerminalAgent | null): Promise<void> {
    if (disposed) return;
    const size = options.getSize();
    if (!size) {
      status.value = "error";
      error.value = "The terminal viewport is not ready yet";
      return;
    }

    const operation = ++generation;
    attachment.value = null;
    status.value = "starting";
    error.value = null;
    try {
      const result = await options.source.startTerminalSession(
        options.taskId,
        options.tab,
        agentCli,
        size,
        (event) => receive(operation, event),
      );
      if (!isCurrent(operation)) {
        await detachRemote(result);
        return;
      }
      acceptAttachment(result);
    } catch (reason) {
      if (!isCurrent(operation)) return;
      status.value = "error";
      error.value = errorMessage(reason);
    }
  }

  async function reattach(): Promise<void> {
    if (disposed) return;
    const operation = ++generation;
    attachment.value = null;
    status.value = "starting";
    error.value = null;
    try {
      const result = await options.source.reattachTerminalSession(
        options.taskId,
        options.tab,
        (event) => receive(operation, event),
      );
      if (!isCurrent(operation)) {
        if (result) await detachRemote(result);
        return;
      }
      if (!result) {
        status.value = "notStarted";
        return;
      }
      acceptAttachment(result);
    } catch (reason) {
      if (!isCurrent(operation)) return;
      status.value = "error";
      error.value = errorMessage(reason);
    }
  }

  async function sendInput(data: string): Promise<void> {
    const current = attachment.value;
    if (!current || !connected.value) return;
    try {
      await options.source.sendTerminalInput(current.session.id, data);
    } catch (reason) {
      if (attachment.value !== current) return;
      status.value = "error";
      error.value = errorMessage(reason);
    }
  }

  async function resize(size: TerminalSize): Promise<void> {
    const current = attachment.value;
    if (!current || !connected.value) return;
    try {
      await options.source.resizeTerminalSession(current.session.id, size);
    } catch (reason) {
      if (attachment.value !== current) return;
      status.value = "error";
      error.value = errorMessage(reason);
    }
  }

  async function detach(): Promise<void> {
    generation += 1;
    const current = attachment.value;
    attachment.value = null;
    if (current) await detachRemote(current);
  }

  async function dispose(): Promise<void> {
    disposed = true;
    await detach();
  }

  return { attachment, status, error, connected, start, reattach, sendInput, resize, detach, dispose };
}
