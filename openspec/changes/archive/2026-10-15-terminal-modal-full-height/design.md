# Design

## Context

See proposal.md for motivation and `specs/embedded-terminal-layout/spec.md` for the user-visible requirement. The modal currently caps desktop height at 760px, leaves 80px of total vertical viewport margin, and uses a 24px vertical margin in its narrow-window rule. Its CSS grid already gives the terminal panel the remaining space between the header, tabs, and footer.

## Goals / Non-Goals

**Goals:**

- Size the modal to the full app-window height at desktop and narrow window sizes.
- Let the existing terminal content row absorb the additional height without changing session behavior.

**Non-Goals:**

- Changing modal width, controls, content, terminal lifecycle, or keyboard behavior.
- Removing the modal backdrop or redesigning its visual treatment.

## Decisions

- Use the app window's viewport height as the modal's vertical sizing reference, remove the 760px cap and vertical margins, and preserve the current desktop and narrow-window width rules. A larger fixed cap would still leave space unused on taller windows; making the modal full width is outside the requested vertical change.
- Preserve the current grid rows (`auto auto minmax(0, 1fr) auto`) and the terminal pane's minimum-size constraints. This allows the terminal viewport to expand while the header, tabs, and footer retain their existing sizing.
- Keep the native modal dialog, backdrop, and existing content structure. No process, focus, or interaction changes are required.

## Risks / Trade-offs

- On short app windows, fixed-size modal controls leave less space for the terminal viewport → Keep the terminal row shrinkable and verify that the header, tabs, and footer remain visible at a constrained window height.
- A full-height modal has no top or bottom breathing room → This is intentional; retain the existing border and horizontal sizing so the requested change remains limited to vertical space.

## Migration Plan

No data or dependency migration is needed. Update the modal sizing rules and the terminal-modal description in `docs/design/SPEC.md`; verify the modal at the approved 1440×900 reference size and at a short, narrow app-window size. Roll back by restoring the previous height and margin rules if the terminal content or controls do not fit correctly.
