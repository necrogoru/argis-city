import type { Snapshot } from "../../domain/types";
import { POLL_INTERVAL_MS, type AgentSource } from "../agentSource";
import { buildSession } from "./mockFactory";
import { SESSION_SEEDS } from "./mockSeed";
import { providerSummaries, tickSnapshot } from "./mockTick";

/** "busy" = the full demo city; "empty" = no sessions, Pi not installed. */
export type MockScenario = "busy" | "empty";

export function createSeedSnapshot(now: number, scenario: MockScenario = "busy"): Snapshot {
  const seeds = scenario === "busy" ? SESSION_SEEDS : [];
  const sessions = seeds.map((seed, i) => buildSession(seed, i + 1, now));
  const missing = scenario === "empty" ? (["pi"] as const) : [];
  return { generatedAt: now, sessions, providers: providerSummaries(sessions, missing) };
}

/** In-browser stand-in for the Tauri backend: realistic data that ticks every 2 s. */
export class MockAgentSource implements AgentSource {
  readonly kind = "demo" as const;
  private snapshot: Snapshot;
  private readonly listeners = new Set<(snapshot: Snapshot) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticks = 0;

  constructor(
    scenario: MockScenario = "busy",
    private readonly intervalMs = POLL_INTERVAL_MS,
    private readonly rnd: () => number = Math.random,
  ) {
    this.snapshot = createSeedSnapshot(Date.now(), scenario);
  }

  async getSnapshot(): Promise<Snapshot> {
    return this.snapshot;
  }

  async refresh(): Promise<Snapshot> {
    this.advance();
    return this.snapshot;
  }

  subscribe(callback: (snapshot: Snapshot) => void): () => void {
    this.listeners.add(callback);
    this.timer ??= setInterval(() => this.advance(), this.intervalMs);
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }

  async openPath(path: string): Promise<void> {
    console.info(`[argis mock] would reveal ${path} in Finder`);
  }

  private advance(): void {
    this.ticks += 1;
    this.snapshot = tickSnapshot(this.snapshot, Date.now(), this.rnd, this.ticks);
    this.listeners.forEach((listener) => listener(this.snapshot));
  }
}
