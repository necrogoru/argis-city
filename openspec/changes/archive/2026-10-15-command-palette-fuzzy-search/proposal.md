# Proposal

## Why

The command palette currently requires contiguous query text and groups matches by result type, so the best result may not appear first. When the input is empty, its default agent list also obscures the two primary navigation actions. Fuzzy relevance ranking and a focused empty state will make the palette quicker to use with partial or approximate queries.

## What Changes

- With an empty query, show only the `Open Tasks` and `Show Dashboard` actions, in that order.
- As the user types, fuzzy-match and rank agents, tasks, and actions together so the closest results appear first; retain stable ordering for equally relevant results.
- Preserve existing result selection and execution behavior, keyboard navigation, accessibility semantics, and current palette layout and visual tokens.
- Update the approved UI spec to describe the new empty-query and result-order behavior.

## Capabilities

### New Capabilities

- `command-palette-search`: Define the palette's fuzzy relevance ranking and its default navigation actions when the query is empty. The repository has no canonical specs yet; this reuses the capability path already introduced by the in-progress `navigation-shortcuts-search` change.

### Modified Capabilities

None. There is no canonical capability spec under `openspec/specs/` to modify.

## Impact

- Frontend search logic in `src/domain/search.ts` and its tests, plus result composition and rendering in `src/ui/CommandPalette/`.
- `docs/design/SPEC.md` command-palette behavior description.
- No backend, transport, or dependency changes are expected.
