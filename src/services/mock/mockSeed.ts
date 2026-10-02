import type { SessionSeed } from "./mockFactory";

const HOME = "/Users/demo/Sites";
const CTX_200K = 200_000;
const CTX_1M = 1_000_000;
const CTX_272K = 272_000;

/**
 * 5 Claude · 4 Codex · 3 OpenCode · 2 Pi. Sessions cover every status (three
 * "needs you" across districts); subagents do too.
 */
export const SESSION_SEEDS: readonly SessionSeed[] = [
  {
    provider: "claude", title: "argis", cwd: `${HOME}/acme/argis`, model: "claude-opus-4-5",
    status: "running", plan: [5, 8], startedMinAgo: 42, tokens: 1_482_300, context: [148_230, CTX_200K],
    step: "Wiring the snapshot event into the React city scene",
    subagents: [
      { title: "Map Tauri event APIs", kind: "Explore", status: "done", startedMinAgo: 30, tokens: 182_400 },
      { title: "Write layout unit tests", kind: "general-purpose", status: "running", plan: [3, 5], startedMinAgo: 12, tokens: 96_800 },
      { title: "Run pnpm build", kind: "general-purpose", status: "awaitingApproval", plan: [1, 3], startedMinAgo: 4, tokens: 21_500 },
      { title: "Audit CSS tokens", kind: "Explore", status: "idle", startedMinAgo: 9, tokens: 44_100 },
    ],
  },
  {
    provider: "claude", title: "billing-service · webhook retries", cwd: `${HOME}/acme/billing-service`,
    model: "claude-sonnet-4-5", status: "awaitingApproval", startedMinAgo: 18, tokens: 612_000,
    context: [131_000, CTX_200K], step: "Wants to run `pnpm prisma migrate dev`",
  },
  {
    provider: "claude", title: "docs-site", cwd: `${HOME}/acme/docs-site`, model: "claude-sonnet-4-5",
    status: "done", plan: [4, 4], startedMinAgo: 95, tokens: 389_000, context: [61_000, CTX_200K],
    step: "Finished updating the quick-start guide",
  },
  {
    provider: "claude", title: "acme-web · auth refactor", cwd: `${HOME}/acme/web`, model: "claude-opus-4-5",
    status: "running", plan: [2, 7], startedMinAgo: 64, tokens: 2_410_000, context: [402_000, CTX_1M],
    step: "Replacing session cookies with rotating refresh tokens",
    subagents: [
      { title: "Find legacy session usages", kind: "Explore", status: "running", startedMinAgo: 6, tokens: 58_300 },
      { title: "Update e2e fixtures", kind: "general-purpose", status: "error", plan: [2, 6], startedMinAgo: 21, tokens: 133_900 },
    ],
  },
  {
    provider: "claude", title: "infra · terraform plan", cwd: `${HOME}/acme/infra`, model: "claude-haiku-4-5",
    status: "running", startedMinAgo: 7, tokens: 74_000, step: "Reading module outputs for the VPC stack",
  },
  {
    provider: "codex", title: "Migrate payments to Stripe v3", cwd: `${HOME}/acme/payments`, model: "gpt-5-codex",
    status: "running", plan: [2, 6], startedMinAgo: 51, tokens: 905_000, context: [118_000, CTX_272K],
    step: "Porting PaymentIntent confirmation flow",
    subagents: [
      { title: "Generate SDK type stubs", kind: "worker", status: "done", startedMinAgo: 40, tokens: 210_000 },
      { title: "Refactor refund handler", kind: "worker", status: "running", plan: [1, 4], startedMinAgo: 15, tokens: 77_000 },
    ],
  },
  {
    provider: "codex", title: "api-gateway rate limiter", cwd: `${HOME}/acme/api-gateway`, model: "gpt-5-codex",
    status: "idle", startedMinAgo: 130, tokens: 455_000, context: [88_000, CTX_272K],
    step: "Waiting for your next prompt",
  },
  {
    provider: "codex", title: "ml-pipeline dataset loader", cwd: `${HOME}/acme/ml-pipeline`, model: "gpt-5",
    status: "awaitingApproval", plan: [3, 5], startedMinAgo: 26, tokens: 288_000, context: [97_000, CTX_272K],
    step: "Requests approval to download a 4 GB dataset",
  },
  {
    provider: "codex", title: "mobile-app crash triage", cwd: `${HOME}/acme/mobile`, model: "gpt-5-codex",
    status: "error", startedMinAgo: 33, tokens: 164_000, context: [52_000, CTX_272K],
    step: "Turn failed: stream disconnected before completion",
  },
  {
    provider: "opencode", title: "design-system tokens", cwd: `${HOME}/studio/design-system`,
    model: "anthropic/claude-sonnet-4-5", status: "running", plan: [6, 9], startedMinAgo: 38, tokens: 540_000,
    context: [92_000, CTX_200K], step: "Generating dark-mode colour ramps",
    subagents: [
      { title: "Contrast audit", kind: "general", status: "idle", startedMinAgo: 20, tokens: 35_000 },
      { title: "Storybook snapshots", kind: "general", status: "running", plan: [2, 3], startedMinAgo: 8, tokens: 41_000 },
    ],
  },
  {
    provider: "opencode", title: "cli-tool flags parser", cwd: `${HOME}/studio/cli`, model: "openai/gpt-5",
    status: "awaitingApproval", startedMinAgo: 75, tokens: 120_000, context: [40_000, CTX_272K],
    step: "Asks permission to run `cargo publish --dry-run`",
  },
  {
    provider: "opencode", title: "analytics dashboard", cwd: `${HOME}/studio/analytics`,
    model: "anthropic/claude-opus-4-5", status: "done", plan: [5, 5], startedMinAgo: 14, tokens: 210_000,
    context: [156_000, CTX_200K], step: "Cohort retention query merged",
  },
  {
    provider: "pi", title: "dotfiles", cwd: "/Users/demo/.dotfiles", model: "claude-sonnet-4-5",
    status: "running", startedMinAgo: 5, tokens: 38_000, context: [21_000, CTX_200K], step: "Editing zsh prompt",
  },
  {
    provider: "pi", title: "blog", cwd: `${HOME}/personal/blog`, model: "gemini-2.5-pro",
    status: "idle", startedMinAgo: 48, tokens: 96_000, context: [33_000, CTX_1M], step: "Draft saved",
  },
];

/** Rotating status lines so running agents look alive. */
export const STEP_LINES: readonly string[] = [
  "Reading files in src/",
  "Running the test suite",
  "Editing components and re-running tsc",
  "Searching the codebase for call sites",
  "Summarising changes for review",
  "Applying a patch to 3 files",
];
