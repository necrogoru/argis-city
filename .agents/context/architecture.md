# Architecture

How a session on disk becomes a house in the city, and where new code belongs.
`docs/CONTRACT.md` is the source of truth for wire types and detection rules;
this file is the map around it.

## Data flow

```
~/.claude  ~/.codex  ~/.local/share/opencode  ~/.pi/agent      (read-only)
     │         │              │                   │
     ▼         ▼              ▼                   ▼
providers::{claude, codex, opencode, pi}   impl AgentProvider
     │   collect(&CollectContext { processes, now_ms }) -> Vec<AgentSession>
     ▼
monitor::ProviderRegistry   runs every provider; a failure → that provider's `error`
     ▼
monitor::Monitor            keeps the latest Snapshot (parking_lot RwLock)
     ▼
monitor::Poller             thread "argis-poller": refresh every 2 s
     │                         └─ emit "agents://snapshot" (lib.rs SNAPSHOT_EVENT)
commands.rs                 get_snapshot · refresh_snapshot · open_path
═══════════════════════ Tauri IPC ═══════════════════════
services/tauriAgentSource   invoke + listen (or services/mock/* in a browser)
     ▼  app.provide(agentSourceKey, …) in main.ts → inject via useAgentSource()
stores/snapshot             shallowRef<Snapshot>; an older snapshot never replaces a newer one
     ▼
stores/selection            reconcileSelection(raw, snapshot); selectedSession
stores/hover                hoveredId shared by houses and agent-list rows
stores/cameraRig            camera-controls instance + framing (math in scene/layout.ts)
     ▼
scene/  (TresJS canvas)     ui/  (DOM overlay on top of the canvas)
```

## Backend (`src-tauri/src/`)

| Module | Role | Notes |
| --- | --- | --- |
| `lib.rs` | Composition root: `build_registry`, `run()` | The only place providers are wired in |
| `commands.rs` | Tauri commands | Thin; blocking work in `spawn_blocking`; errors → `String` |
| `domain/` | Wire types (`Snapshot`, `AgentSession`, `Progress`, `Tokens`, `Status`, `ProviderId`) | `serde(rename_all = "camelCase")`, pure, no I/O |
| `providers/mod.rs` | `AgentProvider` trait, shared time windows | `RUNNING_WINDOW_MS`, `APPROVAL_STALE_MS`, `CANDIDATE_WINDOW_MS` |
| `providers/claude/` | Live registry `sessions/<pid>.json` + transcripts + subagents | Token dedupe by `message.id` |
| `providers/codex/` | `state_*.sqlite` thread index + rollout JSONL | |
| `providers/opencode/` | `opencode.db`, legacy and V2 layouts merged | `layout.rs` normalizes; model catalog for context windows |
| `providers/pi/` | Per-cwd session JSONL | No subagents |
| `shared/jsonl.rs` | `JsonlTailCache<S>`: byte offset + folded state per file | Only appended lines are parsed; a shrunk file is re-read |
| `shared/liveness.rs` | Process match, then a recent-write fallback | |
| `shared/sqlite.rs` | `open_read_only`, schema probes (`has_table`, `has_column`) | Tools change schemas; probe instead of assuming |
| `system/` | `ProcessSource`, `Clock`, `HomePaths` | Traits/structs injected so tests use temp dirs and fake clocks |
| `monitor/` | `ProviderRegistry`, `Monitor`, `Poller` | `registry_tests.rs` covers isolation between providers |
| `examples/dump_snapshot.rs` | Prints this machine's snapshot + cold/warm collect time | Fast loop for provider work |

Each provider follows the same shape: discover candidate sessions (registry,
index or directory scan), decide liveness, fold the transcript or rows into
tokens, plan, status and current step, then build an `AgentSession`. Tests in
the provider's `tests.rs` write fixture files into a `tempfile` dir and point a
`HomePaths` at it.

## Frontend (`src/`)

| Folder | Role | Notes |
| --- | --- | --- |
| `domain/` | Types, status/progress/format helpers, search, selection rules, KPIs, palette | Framework-free; logic modules have a colocated `*.test.ts` |
| `services/` | `AgentSource` interface, Tauri impl, mock impl (`mockSeed`, `mockTick`) | `createAgentSource()` picks one (Tauri unless `?mock`) |
| `stores/` | Pinia setup stores | Thin; delegate logic to `domain/` |
| `composables/` | `useNow`, `useModKey`, `useCursor`, `usePressClick`, `useOcclusion`, `useEffectComposer`, … | VueUse underneath |
| `scene/` | `CityCanvas` → `CityScene` → `District` → `Tower` / `house/House` | Pure modules: `layout.ts`, `cityModel.ts`, `connectionModel.ts`, `geometries.ts`, `materials.ts`, `frameRate.ts`, `frameDriver.ts` |
| `ui/` | `App.vue` = `CityCanvas` + `Overlay` (`TopBar`, `Hero`, `CameraControls`, `EmptyState`, `RightColumn` → agent list / panel, `SubagentStrip`) | ⌘K `CommandPalette` lives in `TopBar/SearchTrigger` as a native `<dialog>` (top layer, no Teleport) |
| `styles/` | `tokens.css`, `base.css` | Global; everything else is `<style scoped>` |

City layout: towers sit on a 2×2 diamond (`TowerSlot`: back/left/front/right
in `domain/providers.ts`, positions in `scene/layout.ts`). Houses ring their
tower, with a second ring after 8. A fifth provider needs a layout decision first.

## Where new code goes

- A new field on a session: Rust `domain/` → provider(s) → `types.ts` →
  `CONTRACT.md` → UI, plus mock data in `services/mock/mockSeed.ts`.
- A new derived value for the UI: a pure function in `src/domain/` with a test,
  exposed through a `computed` in a store or component.
- A new visual effect in the city: a component under `scene/` or `scene/house/`
  that animates in `onBeforeRender`, with shared geometry/material singletons in
  `geometries.ts` / `materials.ts`.
- A new command: a function in `commands.rs`, registered in `generate_handler!`,
  added to `AgentSource` (both implementations) and to the Transport table.

## Tests

- Frontend: `pnpm exec vitest run` covers `src/**/*.test.ts` in a `node`
  environment, with no DOM or WebGL. Keep logic testable by moving it out of
  components.
- Backend: `cargo test` covers unit tests next to the code, with fixture files
  in temp dirs. No test touches the real `~/.claude` and friends.
- No end-to-end suite. UI behaviour is checked by hand in `pnpm tauri dev` or
  with the browser mock (`pnpm dev`, `?mock`, `?mock=empty`).
