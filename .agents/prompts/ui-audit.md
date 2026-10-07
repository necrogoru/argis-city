---
description: Audit a UI area against the approved spec, without editing it
argument-hint: <component, folder or screen, e.g. src/ui/AgentPanel>
---

Audit this part of the Argis UI: $ARGUMENTS

This is a read-only audit. Don't edit files. Argis already has an approved
design (`docs/design/SPEC.md`), so the job is to find where the code drifts
from it or falls short of craft. Don't propose a new design.

## Load

- The `hallmark` skill, run as `hallmark audit` (punch list, no edits).
  Its theme catalog, macrostructures and landing-page guidance don't apply
  here; use its anti-pattern checks and the critique axes.
- The `css-coder` skill for CSS quality, accessibility and motion.
- `docs/design/SPEC.md` (tokens, layout, status visuals) and
  `src/styles/tokens.css`.
- `.agents/context/performance.md` → the CSS rules.

## Check

- **Spec fidelity:** sizes, radii, type scale, spacing and colours match
  `SPEC.md`. Tokens are used, with no raw hex in components. Status colours and
  icons match the status table.
- **States:** hover, focus-visible, active, disabled, empty, loading, error and
  stale data, plus long titles, paths and numbers (truncation, `tabular-nums`).
- **Accessibility:** keyboard reachability and order, visible focus, accessible
  names on icon buttons, contrast of `text-2` / `text-3` on glass,
  `prefers-reduced-motion`.
- **Motion and cost:** infinite animations only on `opacity` / `transform`,
  nothing that repaints a `backdrop-filter` panel every frame.
- **Consistency:** the same pattern drawn the same way across the app (pills,
  stat tiles, icon buttons, section captions).

## Report

A punch list ranked by impact. Each item gets `file:line`, the spec line or
principle it breaks, and the smallest fix. Put anything that would change the
approved design in a separate "needs a design decision" list.
