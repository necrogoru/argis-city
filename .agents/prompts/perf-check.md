---
description: Measure the production build's CPU and memory with the window visible
argument-hint: "[what changed, to compare against the baseline]"
---

Measure Argis's CPU and memory for: $ARGUMENTS

Read `.agents/context/performance.md` first. It has the baseline and explains
why the window must be frontmost.

## Steps

1. **Warn the user before anything pops up.** A test window will sit on top
   of their screen for about 30 s per batch. Wait for their go-ahead.
2. Build a production test copy that stays on top, into a scratch target dir
   so the regular build is untouched:
   - `CARGO_TARGET_DIR=<scratch>/target pnpm tauri build --no-bundle --config '<json>'`
   - `<json>` sets `app.windows` to the full window object from
     `src-tauri/tauri.conf.json` plus `"alwaysOnTop": true`. The JSON merge
     replaces arrays rather than merging them, so copy every field.
3. Launch the binary from `<scratch>/target/release/` and let it settle for
   about 10 s.
4. Sample for about 30 s, focused, then again unfocused (click another app
   but leave Argis visible on top):
   - CPU per process: `com.apple.WebKit.WebContent`, `com.apple.WebKit.GPU`
     and the `argis` host (for example `top -l <n> -s 1 -stats pid,command,cpu`,
     filtered to those pids).
   - Memory: `footprint <WebContent pid>`.
   - Check the z-order with CGWindowList during sampling. Throw out any sample
     taken while Argis wasn't the frontmost window.
5. Quit the test build. Run the same steps on `main` (or the base commit) if
   the baseline in `performance.md` might be stale.

## Report

A table with WebContent, GPU and UI host CPU (focused and unfocused) and the
WebContent footprint, for the change next to the baseline. Note the
run-to-run spread and give a verdict: better, within noise, or worse. If it's
worse, name the likely cause and point at the code.
