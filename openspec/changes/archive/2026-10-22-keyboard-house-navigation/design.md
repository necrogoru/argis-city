# Design

## Context

See `proposal.md` for motivation and `specs/dashboard-house-navigation/spec.md` for the behavior contract. The Dashboard city is already built in stable provider order, with each district's houses in stable house order. Pointer activation selects a house through the selection store; selection reveals the detail panel and focuses its provider. House labels are deliberately hidden from assistive technology because they are pointer-only, while the Dashboard terminal rail already owns its focused keyboard controls.

## Goals / Non-Goals

**Goals:**
- Keep keyboard browsing state separate from committed house selection.
- Reuse the existing stable city ordering and selection behavior rather than add a second navigation model.
- Give the cursor visible feedback and a screen-reader announcement without changing the approved layout or design tokens.
- Preserve existing app shortcuts, terminal-rail navigation, and selection Escape behavior.

**Non-Goals:**
- Reordering houses spatially by their rendered screen position.
- Changing pointer interactions, the agent list, camera controls, or terminal-rail behavior.
- Adding persisted state, backend behavior, dependencies, or new design tokens.

## Decisions

1. **Represent the keyboard cursor separately from selection.** Keep a transient candidate session ID separate from the committed `Selection`; moving through houses must not open the detail panel or move the camera. Enter commits the candidate through the existing session-selection path. Clear the candidate when committed, when its session disappears from the snapshot, and when leaving Dashboard.
   - *Alternative:* Select each house as soon as an arrow is pressed. Rejected because it makes Enter redundant and makes browsing change the focused house before explicit confirmation.

2. **Use the model's stable linear order.** Flatten `CityModel.districts` and each district's `houses` in their existing order. A pure domain resolver should map Left/`h` to the previous item and Right/`l` to the next, wrapping at the ends. When no candidate exists, anchor movement on the selected house if one exists; otherwise begin at the first house for next and last house for previous.
   - *Alternative:* Choose the geometrically nearest house in the pressed direction. Rejected because the city is arranged in provider districts and house rings, so nearest-neighbor rules would be harder to predict and test.

3. **Attach Dashboard key handling to the city interaction boundary.** Handle keys only while the city view is mounted and only when the event is unmodified, unhandled, and not composing. Exclude editable elements, open dialogs, terminal inputs, the terminal rail, and native interactive controls. This keeps the existing `g d`/`g t`, `g r`, and rail controls authoritative in their contexts.
   - *Alternative:* Add another unrestricted document-level shortcut handler. Rejected because it could consume text entry, dialog actions, or keys intended for focused controls.

4. **Provide feedback without treating scene labels as focusable controls.** Extend house presentation with a separate cursor state and reuse the existing label emphasis treatment, leaving the selected-house marker untouched. Since house labels are `aria-hidden`, expose the current candidate's title and provider through a polite live announcement in the DOM overlay.
   - *Alternative:* Make each rendered label a native tab stop. Rejected because labels are projected scene decoration rather than a stable DOM list, which would create a second and incomplete keyboard order.

5. **Extend selection Escape handling, not its existing semantics.** Clear the transient cursor and then apply the current one-layer selection escape: a selected house is cleared before provider focus. This keeps Escape consistent with current Dashboard behavior while meeting the new navigation interaction.

## Risks / Trade-offs

- **Keyboard shortcuts may conflict with focused UI controls** → Restrict handling to the city interaction context, preserve default-prevented events, and verify controls, dialogs, inputs, xterm, and terminal-rail focus explicitly.
- **A poll may remove the candidate house while the user is browsing** → Store the candidate by stable session ID and clear it when the current city no longer contains that ID.
- **Cursor emphasis could be confused with pointer hover** → Use the same restrained label treatment but keep a separate state flag, and retain the existing selected-house marker as the committed-focus indicator.

## Migration Plan

Not applicable. The cursor is transient frontend state; no persisted data or backend contract changes are required.
