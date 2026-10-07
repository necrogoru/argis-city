# Argis — agent guide

Argis is a macOS desktop app (Tauri 2) that renders every coding-agent session
running on this machine as a 3D city: one tower per tool (Claude Code, Codex,
OpenCode, Pi), one house per live session, subagents as cards. A Rust backend
reads each tool's local files read-only and pushes a snapshot to a Vue + TresJS
frontend every 2 s.

## Stack

- **Frontend:** Vue 3.5 (`<script setup lang="ts">`), Pinia setup stores,
  VueUse, TresJS (`@tresjs/core`, `@tresjs/cientos`) on three.js,
  `postprocessing`, `@lucide/vue`, plain CSS (`<style scoped>` + global tokens).
- **Backend:** Rust 1.99 (pinned in `src-tauri/rust-toolchain.toml`), Tauri 2,
  `serde`, `rusqlite` (bundled), `sysinfo`, `anyhow`, `parking_lot`. No async
  runtime of its own: a poller thread, and `spawn_blocking` in commands.
- **Tooling:** pnpm, Vite 8, Vitest, `vue-tsc`, rustfmt (`max_width = 120`),
  clippy. No ESLint or Prettier: match the surrounding code (double quotes,
  semicolons, 2-space indent in TS/Vue).

## Commands

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Desktop app (dev) | `pnpm tauri dev` |
| Browser + mock data | `pnpm dev` → http://localhost:1420 (`?mock=empty` for the empty city) |
| Type-check + build UI | `pnpm build` (runs `vue-tsc --noEmit`) |
| Frontend tests | `pnpm exec vitest run` |
| Rust tests | `cargo test --manifest-path src-tauri/Cargo.toml` |
| Rust lint | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` |
| Rust format | `cargo fmt --manifest-path src-tauri/Cargo.toml` |
| Real snapshot as JSON | `cargo run --manifest-path src-tauri/Cargo.toml --example dump_snapshot` |
| Release bundle | `pnpm tauri build` |

**Gate before you say "done":** `pnpm build`, `pnpm exec vitest run`,
`cargo test`, `cargo clippy … -D warnings` and `cargo fmt --check` all pass.
They pass on `main` today, so keep it that way.

## Where things live

```
src/                      Vue frontend
  domain/                 pure TS: wire types, formatting, selection, search (+ *.test.ts)
  services/               AgentSource: Tauri backend or in-browser mock
  stores/                 Pinia: snapshot, selection, hover, cameraRig
  composables/            useXxx, built on VueUse
  scene/                  TresJS city (towers, houses, lines, effects, frame driver)
  ui/                     DOM overlay (top bar, hero, agent list/panel, ⌘K palette, subagents)
  styles/                 tokens.css (design tokens), base.css
src-tauri/src/            Rust backend
  domain/                 wire types (serde camelCase), mirror of src/domain/types.ts
  providers/<tool>/       one AgentProvider per tool: on-disk state + processes → sessions
  shared/                 JSONL tail cache, liveness, read-only SQLite, text, time
  system/                 injectable OS adapters: processes, clock, home paths
  monitor/                registry (all providers) + poller thread
  commands.rs, lib.rs     Tauri commands and the composition root
docs/CONTRACT.md          backend ⇄ UI contract and per-tool detection rules
docs/design/SPEC.md       approved UI spec: tokens, layout, status visuals, 3D scene
```

Read `.agents/context/architecture.md` before you change code in both
`src/` and `src-tauri/`.

## Rules

### Things that must change together

- Wire types: `src/domain/types.ts` ⇄ `src-tauri/src/domain/` ⇄ `docs/CONTRACT.md`.
  Timestamps are Unix epoch **milliseconds**. `Option` serializes as `null` and
  is never omitted.
- Colours: `src/styles/tokens.css` ⇄ `src/domain/palette.ts` (WebGL can't read
  CSS variables) ⇄ `docs/design/SPEC.md`.
- Commands and events: `generate_handler![…]` in `lib.rs` ⇄
  `services/tauriAgentSource.ts` ⇄ the Transport table in `docs/CONTRACT.md`.
- The TresJS patch: `patches/@tresjs__core@5.9.2.patch` ⇄
  `src/scene/tresPatch.test.ts`. If you bump `@tresjs/core`, re-create the patch
  and keep the test passing.

### Performance (read `.agents/context/performance.md` before touching `scene/` or CSS animations)

- `snapshot` is a `shallowRef` that is replaced whole every poll. Derive data
  with `computed` and never deep-proxy it.
- three.js objects, materials, geometries and camera-controls are never
  reactive (use `markRaw`, `shallowRef` or module scope). Per-frame animation
  mutates them in `onBeforeRender`, never through reactive state.
- CPU scales with frame rate, not scene size. Keep the frame policy (uncapped
  while the camera moves, 30 fps focused, 15 fps unfocused) and the frame driver
  that parks the loop between frames.
- Infinite CSS animations animate only `opacity` and `transform` (never
  `box-shadow` or filters, least of all inside `backdrop-filter` panels).
- Take CPU/RAM numbers only while the app window is verifiably frontmost:
  macOS stops rendering covered windows.

### Backend

- Providers are **read-only** observers. Never write to, lock or migrate a
  tool's data dir. SQLite goes through `shared::sqlite::open_read_only`.
- One failing provider must never break the others (the registry reports
  errors per provider).
- Inject OS access (`ProcessSource`, `Clock`, `HomePaths`) so tests run on temp
  dirs. Tests live in sibling `tests.rs` / `*_tests.rs` files.
- Keep `anyhow::Result` inside providers and map errors to `String` at the
  command boundary. Keep commands thin and run blocking work in `spawn_blocking`.
- Large transcripts are polled every 2 s: read them incrementally through
  `shared::jsonl::JsonlTailCache` instead of re-reading whole files.
- Tauri capabilities (`src-tauri/capabilities/default.json`) stay minimal. Ask
  before you add a permission or plugin.

### Frontend

- `<script setup lang="ts">`, type-based `defineProps`, and `<style scoped>`
  that uses the tokens from `tokens.css`. Don't put raw hex values in
  components.
- Framework-free logic goes in `src/domain/` or a pure `scene/*.ts` module with
  a colocated `*.test.ts` (Vitest, `node` environment, no DOM).
- Components depend on the injected `AgentSource`, never on `@tauri-apps/api`
  directly.
- Pixel values come from the 1440×900 design in `docs/design/SPEC.md`. Don't
  convert the codebase to `rem` or logical properties wholesale.

### Process

- Commits use Conventional Commits with an optional scope, as in the history:
  `feat(vue): …`, `perf(vue): …`, `fix: …`, `docs: …`, `build: …`, `chore: …`.
- Ask before you add a dependency, change `tauri.conf.json`, or change the
  design (layout, tokens, fonts, copy).
- Larger work gets a spec and a plan first, under `docs/superpowers/specs/` and
  `docs/superpowers/plans/`.

## `.agents/` — skills, context, prompts

```
.agents/
  skills/     installed skills (managed by `npx skills`, pinned in skills-lock.json)
  context/    background docs: load the one that matches the task
  prompts/    reusable task prompts (also Claude Code slash commands via .claude/commands)
```

### Skills

Load a skill when the task matches it. Where a skill disagrees with this file
or with the existing code, **this file and the code win**. Skills are general
advice; the rules above are this project's decisions.

| Skill | Use for | Project overrides |
| --- | --- | --- |
| `vue` | SFCs, macros, reactivity, watchers | — |
| `pinia` | stores, `storeToRefs`, store testing | Setup stores only |
| `antfu` | TS code organization and conventions | No ESLint config or new tooling unless asked; keep the existing quote/semicolon style |
| `rust-best-practices` | writing or reviewing Rust: ownership, errors, clippy, tests | `anyhow` inside the crate and `String` errors at commands (no `thiserror` migration); `.expect` in `run()` stays |
| `tauri` | commands, events, capabilities, CSP, config, bundling | Minimal permissions; ask before adding plugins |
| `css-coder` | writing or reviewing CSS | Tokens from `tokens.css`; px as in the spec; opacity/transform-only animations |
| `hallmark` | design critique (`hallmark audit`) | Argis has an approved spec: audit only, and don't redesign or re-theme without the user's go-ahead |

Update or restore them with `npx skills update` and
`npx skills experimental_install`. Add new ones with
`npx skills add <owner/repo> -s <skill> -a claude-code codex opencode pi`.

### Context

| File | Load when |
| --- | --- |
| `.agents/context/architecture.md` | changing data flow, adding a provider, or working across Rust and Vue |
| `.agents/context/performance.md` | touching `scene/`, the render loop, reactivity or CSS animations, or measuring CPU/RAM |
| `docs/CONTRACT.md` | changing wire types or provider detection rules |
| `docs/design/SPEC.md` | any visual or layout change |

### Prompts

| Prompt | Does |
| --- | --- |
| `.agents/prompts/add-provider.md` | adds support for another coding-agent tool, end to end |
| `.agents/prompts/review.md` | runs a pre-merge review against this file's rules |
| `.agents/prompts/perf-check.md` | measures the production build's CPU/RAM the reliable way |
| `.agents/prompts/ui-audit.md` | audits a UI area against the spec without editing it |
