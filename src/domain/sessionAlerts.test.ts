import { describe, expect, it } from "vitest";
import { advanceSessionAlerts, createSessionAlertState } from "./sessionAlerts";
import { session, snapshot, subagent } from "./testFixtures";

describe("advanceSessionAlerts", () => {
  it("uses the initial snapshot as a baseline without alerting for existing approval requests", () => {
    const result = advanceSessionAlerts(
      createSessionAlertState(),
      snapshot([session({ status: "awaitingApproval" })]),
    );

    expect(result.alerts).toEqual([]);
  });

  it("alerts when a session first appears awaiting approval after initialization", () => {
    const baseline = advanceSessionAlerts(createSessionAlertState(), snapshot([session()]));
    const result = advanceSessionAlerts(baseline.state, snapshot([session({ status: "awaitingApproval" })]));

    expect(result.alerts).toMatchObject([{ kind: "approval", sessionId: "claude:abc", subagent: false }]);
  });

  it("alerts once when a running session enters approval and ignores repeated snapshots", () => {
    const baseline = advanceSessionAlerts(createSessionAlertState(), snapshot([session()]));
    const waiting = snapshot([session({ status: "awaitingApproval" })]);
    const first = advanceSessionAlerts(baseline.state, waiting);
    const repeated = advanceSessionAlerts(first.state, waiting);

    expect(first.alerts).toHaveLength(1);
    expect(repeated.alerts).toEqual([]);
  });

  it.each(["idle", "done"] as const)("alerts when a running session completes as %s", (status) => {
    const baseline = advanceSessionAlerts(createSessionAlertState(), snapshot([session()]));
    const result = advanceSessionAlerts(baseline.state, snapshot([session({ status })]));

    expect(result.alerts).toMatchObject([{ kind: "completion", sessionId: "claude:abc", subagent: false }]);
  });

  it("alerts when a subagent newly needs approval", () => {
    const baseline = advanceSessionAlerts(
      createSessionAlertState(),
      snapshot([session({ subagents: [subagent({ id: "child", status: "running" })] })]),
    );
    const result = advanceSessionAlerts(
      baseline.state,
      snapshot([session({ subagents: [subagent({ id: "child", status: "awaitingApproval" })] })]),
    );

    expect(result.alerts).toMatchObject([{ kind: "approval", sessionId: "claude:abc", subagent: true }]);
  });

  it("does not alert when a session errors or disappears", () => {
    const baseline = advanceSessionAlerts(createSessionAlertState(), snapshot([session()]));
    const errored = advanceSessionAlerts(baseline.state, snapshot([session({ status: "error" })]));
    const missing = advanceSessionAlerts(errored.state, snapshot([]));

    expect(errored.alerts).toEqual([]);
    expect(missing.alerts).toEqual([]);
  });

  it("preserves a provider's last status while that provider reports an error", () => {
    const baseline = advanceSessionAlerts(createSessionAlertState(), snapshot([session()]));
    const failedSnapshot = {
      ...snapshot([]),
      providers: [{ provider: "claude" as const, available: true, sessionCount: 0, error: "read failed" }],
    };
    const duringFailure = advanceSessionAlerts(baseline.state, failedSnapshot);
    const recovered = advanceSessionAlerts(duringFailure.state, snapshot([session({ status: "idle" })]));

    expect(duringFailure.alerts).toEqual([]);
    expect(recovered.alerts).toMatchObject([{ kind: "completion", sessionId: "claude:abc" }]);
  });
});
