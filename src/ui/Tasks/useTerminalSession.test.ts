import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TerminalAgent, TerminalAttachment, TerminalEvent, TerminalSize, TerminalTab } from "../../domain/types";
import type { TerminalSessionService } from "./useTerminalSession";
import { useTerminalSession } from "./useTerminalSession";

const attachment: TerminalAttachment = {
  session: {
    id: 71,
    key: { taskId: 12, tab: "agent" },
    agentCli: "claude",
    processId: 812,
    running: true,
  },
  attachmentId: 3,
};

const size: TerminalSize = { cols: 88, rows: 28 };

function createSource(): TerminalSessionService & {
  startTerminalSession: ReturnType<typeof vi.fn<TerminalSessionService["startTerminalSession"]>>;
  reattachTerminalSession: ReturnType<typeof vi.fn<TerminalSessionService["reattachTerminalSession"]>>;
  sendTerminalInput: ReturnType<typeof vi.fn<TerminalSessionService["sendTerminalInput"]>>;
  resizeTerminalSession: ReturnType<typeof vi.fn<TerminalSessionService["resizeTerminalSession"]>>;
  detachTerminalSession: ReturnType<typeof vi.fn<TerminalSessionService["detachTerminalSession"]>>;
} {
  return {
    startTerminalSession: vi.fn<TerminalSessionService["startTerminalSession"]>(),
    reattachTerminalSession: vi.fn<TerminalSessionService["reattachTerminalSession"]>(),
    sendTerminalInput: vi.fn<TerminalSessionService["sendTerminalInput"]>(async () => {}),
    resizeTerminalSession: vi.fn<TerminalSessionService["resizeTerminalSession"]>(async () => {}),
    detachTerminalSession: vi.fn<TerminalSessionService["detachTerminalSession"]>(async () => true),
  };
}

function setup(tab: TerminalTab = "agent", agentCli: TerminalAgent | null = "claude") {
  const source = createSource();
  const writes: Uint8Array[] = [];
  const session = useTerminalSession({
    source,
    taskId: 12,
    tab,
    getSize: () => size,
    write: (bytes) => writes.push(bytes),
  });
  return { source, writes, session, agentCli };
}

describe("useTerminalSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts a selected process with the visible PTY size and streams its output", async () => {
    const { source, writes, session, agentCli } = setup();
    source.startTerminalSession.mockResolvedValue(attachment);

    await session.start(agentCli);

    expect(source.startTerminalSession).toHaveBeenCalledWith(12, "agent", "claude", size, expect.any(Function));
    expect(session.attachment.value).toEqual(attachment);
    expect(session.status.value).toBe("running");

    const onEvent = source.startTerminalSession.mock.calls[0][4];
    onEvent({ type: "output", sessionId: attachment.session.id, bytes: [65, 10] });
    expect(writes).toEqual([new Uint8Array([65, 10])]);
  });

  it("passes a non-default supported CLI choice through the agent tab", async () => {
    const { source, session } = setup();
    source.startTerminalSession.mockResolvedValue({
      ...attachment,
      session: { ...attachment.session, agentCli: "opencode" },
    });

    await session.start("opencode");

    expect(source.startTerminalSession).toHaveBeenCalledWith(12, "agent", "opencode", size, expect.any(Function));
    expect(session.status.value).toBe("running");
  });

  it("reattaches a running process and forwards input and resize", async () => {
    const { source, session } = setup("term", null);
    const shellAttachment: TerminalAttachment = {
      ...attachment,
      session: { ...attachment.session, key: { taskId: 12, tab: "term" }, agentCli: null },
    };
    source.reattachTerminalSession.mockResolvedValue(shellAttachment);

    await session.reattach();
    await session.sendInput("pwd\n");
    await session.resize(size);

    expect(source.reattachTerminalSession).toHaveBeenCalledWith(12, "term", expect.any(Function));
    expect(session.status.value).toBe("running");
    expect(source.sendTerminalInput).toHaveBeenCalledWith(shellAttachment.session.id, "pwd\n");
    expect(source.resizeTerminalSession).toHaveBeenCalledWith(shellAttachment.session.id, size);
  });

  it("returns to not-started when no session exists to reattach", async () => {
    const { source, session } = setup();
    source.reattachTerminalSession.mockResolvedValue(null);

    await session.reattach();

    expect(session.status.value).toBe("notStarted");
    expect(session.attachment.value).toBeNull();
  });

  it("shows launch and process errors without marking the process connected", async () => {
    const { source, session } = setup();
    source.startTerminalSession.mockRejectedValue(new Error("claude CLI was not found"));

    await session.start("claude");

    expect(session.status.value).toBe("error");
    expect(session.error.value).toBe("claude CLI was not found");
    expect(session.connected.value).toBe(false);
  });

  it("reflects terminal error and exit events in the connection status", async () => {
    const { source, session } = setup();
    source.startTerminalSession.mockResolvedValue(attachment);
    await session.start("claude");
    const onEvent = source.startTerminalSession.mock.calls[0][4];

    onEvent({ type: "error", sessionId: attachment.session.id, message: "PTY read failed" });
    expect(session.status.value).toBe("error");
    expect(session.error.value).toBe("PTY read failed");

    onEvent({ type: "exited", sessionId: attachment.session.id, exitCode: 0, signal: null });
    expect(session.status.value).toBe("exited");
    expect(session.error.value).toBeNull();
    expect(session.connected.value).toBe(false);
  });

  it("detaches a process channel if startup resolves after the modal has closed", async () => {
    const { source, session } = setup();
    let resolveStart!: (result: TerminalAttachment) => void;
    source.startTerminalSession.mockReturnValue(new Promise((resolve) => (resolveStart = resolve)));

    const starting = session.start("claude");
    await session.detach();
    resolveStart(attachment);
    await starting;

    expect(source.detachTerminalSession).toHaveBeenCalledWith(12, "agent", attachment.attachmentId);
    expect(session.attachment.value).toBeNull();
    expect(session.connected.value).toBe(false);
  });

  it("ignores terminal events from a disposed attachment", async () => {
    const { source, session, writes } = setup();
    source.reattachTerminalSession.mockResolvedValue(attachment);
    await session.reattach();
    const onEvent = source.reattachTerminalSession.mock.calls[0][2];

    await session.detach();
    onEvent({ type: "output", sessionId: attachment.session.id, bytes: [88] } satisfies TerminalEvent);

    expect(writes).toEqual([]);
  });
});
