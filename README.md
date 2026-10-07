# Argis

**See every coding agent on your machine as a living 3D city.**

Argis is a desktop app for macOS that watches the coding-agent sessions running
on your machine and draws them as a city. Each tool gets a tower, each live
session is a house around it, and each subagent is a card. You can see what's
running, what's waiting for you and what's done without switching between
terminals.

## What it shows

- **Towers:** one per tool (Claude Code, Codex, OpenCode, Pi), growing with
  its live session count.
- **Houses:** one per live session. They glow by status: running, needs
  approval, idle, done or error.
- **Agent panel:** progress (from the agent's plan or todo list, otherwise
  context use), current step, tokens, context window, elapsed time, directory,
  PID and subagents.
- **Subagents strip:** the selected session's subagents with their own status
  and progress.
- **⌘K palette:** jump to any agent or district, open a session's folder, move
  the camera, refresh.
- **Top bar:** live counts of active agents, subagents, tokens, and sessions
  waiting on you.

The Rust backend polls every 2 seconds and only **reads** each tool's local
files. It never writes to them, and Argis's own code makes no network
requests. The one request the app makes is for the UI font (Outfit, from
Google Fonts).

| Tool | Reads from |
| --- | --- |
| Claude Code | `~/.claude` (live session registry, transcripts, subagents) |
| Codex | `~/.codex` (thread index `state_*.sqlite`, rollout JSONL) |
| OpenCode | `~/.local/share/opencode/opencode.db`, `~/.cache/opencode/models.json` |
| Pi | `~/.pi/agent/sessions` |

The detection rules for each tool are in [`docs/CONTRACT.md`](docs/CONTRACT.md).

## Getting started

**Requirements:** macOS with the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
(Xcode Command Line Tools), [rustup](https://rustup.rs) (the pinned
toolchain in `src-tauri/rust-toolchain.toml` installs itself), Node.js 22 or
newer, and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm tauri dev      # desktop app, reading your real sessions
pnpm dev            # UI only at http://localhost:1420 with mock data (?mock=empty for the empty city)
pnpm tauri build    # release bundle in src-tauri/target/release/bundle
```

## Development

| Task | Command |
| --- | --- |
| Type-check + build the UI | `pnpm build` |
| Frontend tests (Vitest) | `pnpm exec vitest run` |
| Rust tests | `cargo test --manifest-path src-tauri/Cargo.toml` |
| Rust lint | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` |
| Rust format | `cargo fmt --manifest-path src-tauri/Cargo.toml` |
| Print this machine's snapshot as JSON | `cargo run --manifest-path src-tauri/Cargo.toml --example dump_snapshot` |

**Stack:** Tauri 2 and Rust on the backend. Vue 3, Pinia, VueUse, TresJS
(three.js) and plain scoped CSS on the frontend.

```
src/            Vue frontend: domain logic, Pinia stores, composables, 3D scene, UI overlay
src-tauri/src/  Rust backend: one provider per tool, poller, Tauri commands
docs/           backend ⇄ UI contract, UI spec, design specs and plans
.agents/        skills, context and prompts for coding agents (see below)
```

### Docs

- [`docs/CONTRACT.md`](docs/CONTRACT.md): the backend ⇄ UI contract (commands,
  events, types, detection rules per tool).
- [`docs/design/SPEC.md`](docs/design/SPEC.md): the approved UI spec (tokens,
  layout, status visuals, 3D scene).
- [`docs/superpowers/`](docs/superpowers/): design specs and implementation
  plans for larger changes.

## Working with coding agents

[`AGENTS.md`](AGENTS.md) is the guide for coding agents: stack, commands,
architecture, and the project's rules (performance especially). Codex,
OpenCode and Pi read it directly. Claude Code reads it through `CLAUDE.md`.

```
.agents/
  skills/     agent skills, installed with the skills CLI and pinned in skills-lock.json
  context/    architecture.md, performance.md: background loaded per task
  prompts/    add-provider, review, perf-check, ui-audit
```

Claude Code finds the skills through the symlinks in `.claude/skills/` and
the prompts as slash commands (`/review`, `/add-provider …`) through
`.claude/commands/`.

| Skill | Source | For |
| --- | --- | --- |
| `vue` | [antfu/skills](https://github.com/antfu/skills) | Vue 3.5 Composition API, SFC macros, reactivity |
| `pinia` | [antfu/skills](https://github.com/antfu/skills) | Pinia stores and testing |
| `antfu` | [antfu/skills](https://github.com/antfu/skills) | Anthony Fu's TypeScript conventions |
| `rust-best-practices` | [apollographql/skills](https://github.com/apollographql/skills) | Idiomatic Rust: ownership, errors, clippy, tests (Apollo's handbook) |
| `tauri` | [hairyf/skills](https://github.com/hairyf/skills) | Tauri 2 from the official docs: commands, events, capabilities, CSP |
| `css-coder` | [schalkneethling/webdev-agent-skills](https://github.com/schalkneethling/webdev-agent-skills) | Standards-first CSS: accessibility, performance, modern syntax |
| `hallmark` | [nutlope/hallmark](https://github.com/nutlope/hallmark) | Design critique and anti-slop audits |

```sh
npx skills update                    # update installed skills
npx skills experimental_install      # restore them from skills-lock.json
npx skills add <owner/repo> -s <skill> -a claude-code codex opencode pi
```

## Recommended IDE setup

[VS Code](https://code.visualstudio.com/) with
[Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar),
[Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) and
[rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
