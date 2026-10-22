# Proposal

## Why

Dashboard users can currently select a house with the pointer or through the agent list, but cannot browse the 3D city by keyboard. Add a direct keyboard path to inspect houses while retaining an explicit Enter action before focusing a house.

## What Changes

- Add Dashboard keyboard navigation across visible houses with `h`/`l` or Left/Right Arrow.
- Show which house is under the temporary keyboard cursor without selecting it; Enter commits that house as the focused selection.
- Escape clears the temporary cursor or unfocuses the selected house, without changing the existing one-layer selection behavior.
- Keep navigation out of editable controls, dialogs, and the Dashboard terminal rail so existing keyboard workflows remain intact.

## Capabilities

### New Capabilities
- `dashboard-house-navigation`: Keyboard browsing and explicit focus of houses in the Dashboard city.

### Modified Capabilities

## Impact

- Dashboard keyboard handling and selection state in the Vue frontend (`src/App.vue`, scene components, and selection-related domain/store code).
- House focus feedback and keyboard navigation tests; no backend, wire-contract, or dependency changes expected.
- Existing Dashboard terminal-rail keyboard navigation must remain unaffected.
