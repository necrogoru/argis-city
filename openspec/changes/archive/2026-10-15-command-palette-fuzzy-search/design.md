# Design

## Context

See `proposal.md` for the motivation and `specs/command-palette-search/spec.md` for the behavior contract. Search is pure TypeScript in `src/domain/search.ts`; it currently matches contiguous, case-insensitive query tokens and ranks matches within sessions, tasks, or actions separately. `PaletteBody.vue` combines those groups in fixed Agent → Tasks → Actions order. The current UI spec describes urgent agents and all actions as initial results.

## Goals / Non-Goals

**Goals:**

- Reuse the existing search fields and their relative importance while supporting subsequence matches.
- Put all matching result types in one relevance-ranked list while retaining the existing row visuals and activation behavior.
- Keep the blank-query list small and deterministic, and preserve the current palette's modal, keyboard, and focus behavior.
- Keep search local and synchronous with no dependency or backend changes.

**Non-Goals:**

- Correct spelling substitutions or transposed characters; fuzzy matching means case-insensitive, ordered subsequences with omitted characters allowed.
- Change which fields are searchable, result actions, palette styling tokens, or task/session data loading.

## Decisions

### Extend the existing pure matcher

Extend the matching/scoring helpers in `src/domain/search.ts` rather than adding a package or a second search path. Match each query token as an ordered subsequence of a searchable field, and require every token to match at least one field. Preserve the existing field weights (for example, titles outrank metadata). Rank stronger matches higher using exact/prefix and word-boundary starts, then contiguity and matched span; use the current source order as a deterministic tie-breaker. This keeps the policy testable without Vue or Tauri and avoids a dependency. Edit-distance typo correction is excluded because it can introduce unrelated matches and is not needed for partial-letter matching.

### Build one result list for typed queries

For a non-empty query, produce score-bearing candidates for sessions, tasks, and actions, then sort the combined candidates by match quality. Retain the existing per-type row visuals (agent status, task terminal tile, action icon) so the unified list remains scannable without changing its overall geometry or tokens. Keep arrow-key movement and Enter activation over that same ranked list; reset the active selection on input as today.

For an empty query, bypass agent, task, and general action matching and construct just the Open Tasks and Show Dashboard actions in the requested order. Clearing the query returns to this default. Keep the existing task-search preload unchanged; the blank state simply does not score or display task results.

### Keep the design contract synchronized

Update the command-palette section in `docs/design/SPEC.md` to replace the six-agent initial list and grouped typed results with the two navigation defaults and one globally ranked typed-results list. Preserve the modal dimensions, tokens, row styles, and keyboard hints.

## Risks / Trade-offs

- **Loose subsequences can match unrelated entries** → Require every query token to match, prioritize strong/compact matches, retain existing field weights, and cover both positive and negative cases in pure search tests.
- **Global ranking removes the current section boundaries** → Keep each result's existing type-specific visual treatment and keep the full result type in its row semantics.
- **The capability path is also present in the in-progress `navigation-shortcuts-search` change** → Keep this delta focused on the new empty-state and ranking behavior; reconcile it with the canonical capability spec when that related change is archived.
- **Fuzzy matching runs on each keystroke** → Keep it as a bounded, pure scan of the already-loaded candidate fields and avoid allocations or asynchronous services beyond the existing candidate mapping.

## Migration Plan

No persisted data or transport changes are needed. Ship the frontend search and palette changes together with focused domain/component tests and the `docs/design/SPEC.md` update. Rollback by restoring the prior matching and result-composition behavior; no user data migration or cleanup is required.
