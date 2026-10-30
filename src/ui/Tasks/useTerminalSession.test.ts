import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  TaskAgentResume,
  TerminalAgent,
  TerminalAttachment,
  TerminalEvent,
  TerminalSize,
  TerminalTab,
} from "../../domain/types";
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
  resumeTaskAgent: ReturnType<typeof vi.fn<TerminalSessionService["resumeTaskAgent"]>>;
  getTaskAgentResume: ReturnType<typeof vi.fn<TerminalSessionService["getTaskAgentResume"]>>;
  reattachTerminalSession: ReturnType<typeof vi.fn<TerminalSessionService["reattachTerminalSession"]>>;
  sendTerminalInput: ReturnType<typeof vi.fn<TerminalSessionService["sendTerminalInput"]>>;
  resizeTerminalSession: ReturnType<typeof vi.fn<TerminalSessionService["resizeTerminalSession"]>>;
  stopTerminalSession: ReturnType<typeof vi.fn<TerminalSessionService["stopTerminalSession"]>>;
  forgetTerminalTab: ReturnType<typeof vi.fn<TerminalSessionService["forgetTerminalTab"]>>;
  detachTerminalSession: ReturnType<typeof vi.fn<TerminalSessionService["detachTerminalSession"]>>;
} {
  return {
    startTerminalSession: vi.fn<TerminalSessionService["startTerminalSession"]>(),
    resumeTaskAgent: vi.fn<TerminalSessionService["resumeTaskAgent"]>(),
    getTaskAgentResume: vi.fn<TerminalSessionService["getTaskAgentResume"]>(async () => null),
    reattachTerminalSession: vi.fn<TerminalSessionService["reattachTerminalSession"]>(),
    sendTerminalInput: vi.fn<TerminalSessionService["sendTerminalInput"]>(async () => {}),
    resizeTerminalSession: vi.fn<TerminalSessionService["resizeTerminalSession"]>(async () => {}),
    stopTerminalSession: vi.fn<TerminalSessionService["stopTerminalSession"]>(async () => {}),
    forgetTerminalTab: vi.fn<TerminalSessionService["forgetTerminalTab"]>(async () => false),
    detachTerminalSession: vi.fn<TerminalSessionService["detachTerminalSession"]>(async () => true),
  };
}

function setup(
  tab: TerminalTab = "agent",
  agentCli: TerminalAgent | null = "claude",
  getSize: () => TerminalSize | null = () => size,
) {
  const source = createSource();
  const writes: Uint8Array[] = [];
  const session = useTerminalSession({
    source,
    taskId: 12,
    tab,
    getSize,
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

  it("resumes the saved task conversation through a new Agent PTY", async () => {
    const { source, session } = setup();
    source.resumeTaskAgent.mockResolvedValue(attachment);

    await session.resume();

    expect(source.resumeTaskAgent).toHaveBeenCalledWith(12, size, expect.any(Function));
    expect(session.attachment.value).toEqual(attachment);
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

    expect(source.reattachTerminalSession).toHaveBeenCalledWith(12, "term", size, expect.any(Function));
    expect(session.status.value).toBe("running");
    expect(source.sendTerminalInput).toHaveBeenCalledWith(shellAttachment.session.id, "pwd\n");
    expect(source.resizeTerminalSession).toHaveBeenCalledWith(shellAttachment.session.id, size);
  });

  it("reattaches without a size when the viewport has not been laid out", async () => {
    const { source, session } = setup("term", null, () => null);
    source.reattachTerminalSession.mockResolvedValue(attachment);

    await session.reattach();

    expect(source.reattachTerminalSession).toHaveBeenCalledWith(12, "term", null, expect.any(Function));
    expect(session.status.value).toBe("running");
  });

  it("returns to not-started when no session exists to reattach", async () => {
    const { source, session } = setup();
    source.reattachTerminalSession.mockResolvedValue(null);

    await session.reattach();

    expect(session.status.value).toBe("notStarted");
    expect(session.attachment.value).toBeNull();
    expect(source.getTaskAgentResume).toHaveBeenCalledWith(12);
    expect(session.resumeLookupComplete.value).toBe(true);
    expect(session.resumeUnavailable.value).toBe(true);
  });

  it("loads the saved provider only after finding no live Agent PTY", async () => {
    const { source, session } = setup();
    const reference: TaskAgentResume = {
      taskId: 12,
      provider: "opencode",
      nativeReference: "ses_abc123",
      worktreePath: "/worktrees/12",
      lastObservedAtMs: 100,
    };
    source.reattachTerminalSession.mockResolvedValue(null);
    source.getTaskAgentResume.mockResolvedValue(reference);

    await session.reattach();

    expect(session.resumeReference.value).toEqual(reference);
    expect(session.resumeUnavailable.value).toBe(false);
  });

  it("does not offer a second conversation when an Agent PTY is already live", async () => {
    const { source, session } = setup();
    source.reattachTerminalSession.mockResolvedValue(attachment);

    await session.reattach();

    expect(source.getTaskAgentResume).not.toHaveBeenCalled();
    expect(session.status.value).toBe("running");
  });

  it("checks for a saved conversation after a live Agent PTY exits", async () => {
    const { source, session } = setup();
    source.reattachTerminalSession.mockResolvedValue(attachment);
    source.getTaskAgentResume.mockResolvedValue({
      taskId: 12,
      provider: "claude",
      nativeReference: "12345678-1234-4abc-8def-123456789014",
      worktreePath: "/worktrees/12",
      lastObservedAtMs: 100,
    });
    await session.reattach();
    const onEvent = source.reattachTerminalSession.mock.calls[0][3];

    onEvent({ type: "exited", sessionId: attachment.session.id, exitCode: 0, signal: null });
    await vi.waitFor(() => expect(session.resumeReference.value?.provider).toBe("claude"));

    expect(source.getTaskAgentResume).toHaveBeenCalledOnce();
  });

  it("checks saved metadata when the reattached PTY has already exited", async () => {
    const { source, session } = setup();
    source.reattachTerminalSession.mockResolvedValue({ ...attachment, session: { ...attachment.session, running: false } });
    source.getTaskAgentResume.mockResolvedValue({
      taskId: 12,
      provider: "claude",
      nativeReference: "12345678-1234-4abc-8def-123456789010",
      worktreePath: "/worktrees/12",
      lastObservedAtMs: 100,
    });

    await session.reattach();

    expect(session.status.value).toBe("exited");
    expect(session.resumeReference.value?.provider).toBe("claude");
  });

  it("shows launch and process errors without marking the process connected", async () => {
    const { source, session } = setup();
    source.startTerminalSession.mockRejectedValue(new Error("claude CLI was not found"));

    await session.start("claude");

    expect(session.status.value).toBe("error");
    expect(session.error.value).toBe("claude CLI was not found");
    expect(session.connected.value).toBe(false);
  });

  it("keeps a failed resume unavailable while leaving new-session launch separate", async () => {
    const { source, session } = setup();
    session.resumeReference.value = {
      taskId: 12,
      provider: "claude",
      nativeReference: "12345678-1234-4abc-8def-123456789010",
      worktreePath: "/worktrees/12",
      lastObservedAtMs: 100,
    };
    source.resumeTaskAgent.mockRejectedValue(new Error("saved provider conversation is no longer available"));

    await session.resume();

    expect(session.status.value).toBe("error");
    expect(session.resumeUnavailable.value).toBe(true);
    expect(session.resumeReference.value).toBeNull();
    expect(source.startTerminalSession).not.toHaveBeenCalled();
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

  it("stops a managed shell when its tab closes", async () => {
    const { source, session } = setup("term-2", null);
    const shellAttachment: TerminalAttachment = {
      ...attachment,
      session: { ...attachment.session, key: { taskId: 12, tab: "term-2" }, agentCli: null },
    };
    source.reattachTerminalSession.mockResolvedValue(shellAttachment);
    await session.reattach();

    await session.stop();

    expect(source.stopTerminalSession).toHaveBeenCalledWith(shellAttachment.session.id);
    expect(source.detachTerminalSession).not.toHaveBeenCalled();
    expect(session.attachment.value).toBeNull();
    expect(session.connected.value).toBe(false);
  });

  it("stops a session that finishes starting after its tab closes", async () => {
    const { source, session } = setup("term-2", null);
    const shellAttachment: TerminalAttachment = {
      ...attachment,
      session: { ...attachment.session, key: { taskId: 12, tab: "term-2" }, agentCli: null },
    };
    let resolveStart!: (result: TerminalAttachment) => void;
    source.startTerminalSession.mockReturnValue(new Promise((resolve) => (resolveStart = resolve)));

    const starting = session.start(null);
    await session.stop();
    resolveStart(shellAttachment);
    await starting;

    expect(source.stopTerminalSession).toHaveBeenCalledWith(shellAttachment.session.id);
    expect(source.detachTerminalSession).not.toHaveBeenCalled();
  });

  it("clears a failed-start record when a tab that never attached is closed", async () => {
    const { source, session } = setup("term-2", null);

    await session.stop();

    expect(source.forgetTerminalTab).toHaveBeenCalledWith(12, "term-2");
    expect(source.stopTerminalSession).not.toHaveBeenCalled();
  });

  it("closes the tab even when the process was already reaped", async () => {
    const { source, session } = setup("term-2", null);
    source.reattachTerminalSession.mockResolvedValue(attachment);
    await session.reattach();
    source.stopTerminalSession.mockRejectedValue(new Error("terminal session 71 does not exist"));

    await expect(session.stop()).resolves.toBeUndefined();
    expect(session.attachment.value).toBeNull();
  });

  it("ignores terminal events from a disposed attachment", async () => {
    const { source, session, writes } = setup();
    source.reattachTerminalSession.mockResolvedValue(attachment);
    await session.reattach();
    const onEvent = source.reattachTerminalSession.mock.calls[0][3];

    await session.detach();
    onEvent({ type: "output", sessionId: attachment.session.id, bytes: [88] } satisfies TerminalEvent);

    expect(writes).toEqual([]);
  });
});
