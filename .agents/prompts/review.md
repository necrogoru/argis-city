---
description: Pre-merge review of the current branch against Argis's rules
argument-hint: "[base ref, default main]"
---

Review the changes on this branch against the base ref `$ARGUMENTS` (use
`main` if no ref was given). Report findings only. Don't edit files unless the
user asks.

## 1. Run the gate

```sh
pnpm build
pnpm exec vitest run
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

Quote any failure verbatim.

## 2. Read the diff with these questions

Load the skills that match the touched files: `vue` / `pinia` for `src/`,
`rust-best-practices` / `tauri` for `src-tauri/`, `css-coder` for styles. Then check:

**Contract and mirrors**
- If a wire type changed, did `src/domain/types.ts`, `src-tauri/src/domain/` and
  `docs/CONTRACT.md` all change? Timestamps in ms, `null` and never omitted?
- If a colour changed, do `tokens.css`, `palette.ts` and `SPEC.md` still agree?
- If a command or event changed, do `generate_handler!`, both `AgentSource`
  implementations (Tauri and mock) and the Transport table all agree?

**Performance** (`.agents/context/performance.md`)
- Is anything reactive that should be raw (three.js objects, the snapshot's
  contents)? Does any reactive state change per frame?
- Does a new on-screen interaction call `driver.wake()`?
- Do infinite CSS animations touch only `opacity` and `transform`?
- Do new timers duplicate the shared `useNow()`?

**Backend**
- Do providers stay read-only, with SQLite opened through `open_read_only`?
- Can a failure in one provider leak into the others or into the poller thread?
- Are large files read incrementally? Does any blocking work run on a command
  thread without `spawn_blocking`?
- Are there `unwrap`/`expect` calls outside tests and the `run()` bootstrap?

**Frontend**
- Is new logic pure and tested in `src/domain/` or a `scene/*.ts` module, or is
  it stuck in a component?
- Do components use tokens rather than raw hex, and the injected `AgentSource`
  rather than Tauri directly?

**Scope**
- Are there new dependencies, Tauri permissions or `tauri.conf.json` edits the
  user didn't ask for?
- Do docs (`README.md`, `CONTRACT.md`, `SPEC.md`, `.agents/context/*`) still
  match the code?

## 3. Report

List findings ranked by severity. Each one gets `file:line`, what goes wrong,
and the concrete scenario that triggers it. Finish with a merge verdict.
