# Tasks

## 1. Refine board layout and status cues

- [x] 1.1 Refine spacing in `TaskBoard.vue` and `TaskCard.vue`, remove enclosing lane frames and the card-action divider, and preserve task cards as the primary boundaries; verify the three lanes remain evenly distributed at 1440×900 and reflow without clipping at narrow widths.
- [x] 1.2 Improve status cue salience using the existing semantic palette and add brief status-change feedback; verify each status remains identifiable, the card does not shift, and reduced-motion preference suppresses the transition.
- [x] 1.3 Update `docs/design/SPEC.md` with the open-lane layout, status colors, contrast minimum, and motion behavior; verify the documented palette and contrast requirement match the rendered UI.

## 2. Add the always-visible shortcut legend

- [x] 2.1 Add a compact, always-visible legend below the board toolbar using the existing keycap treatment; verify it names within-lane, between-lane, first/last-task, and `c`/`b`/`t` actions and wraps without horizontal overflow at narrow widths.
- [x] 2.2 Update `docs/design/SPEC.md` with the visible shortcut legend and its exact key mappings; verify each hint matches the existing task-board keyboard behavior and availability guards.

## 3. Integration verification

- [x] 3.1 Run `pnpm build` and `pnpm exec vitest run`; manually verify the Tasks view at 1440×900 and a narrow window, including lane/card spacing, status-change feedback with and without reduced motion, contrast, persistent shortcut hints, and existing keyboard navigation/actions.
