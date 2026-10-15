# Spec Delta

## Purpose

The command palette provides one place to navigate the app and find agents, tasks, and actions. It should expose the primary destinations before search and bring the most relevant results to the top for partial queries.

## ADDED Requirements

### Requirement: Show primary navigation actions for an empty query
When the command palette query is empty, Argis SHALL show only the Open Tasks and Show Dashboard actions, in that order.

#### Scenario: Open the palette without typing
- **WHEN** a user opens the command palette with an empty query
- **THEN** Open Tasks appears first and Show Dashboard appears second, with no agent, task, or other action results

#### Scenario: Restore defaults after clearing a query
- **WHEN** a user clears all text from a non-empty command palette query
- **THEN** the palette returns to the Open Tasks and Show Dashboard actions in that order

### Requirement: Fuzzy-match and globally rank palette results
For a non-empty query, Argis SHALL match agents, tasks, and actions using case-insensitive subsequence matching and display matching results together in descending relevance order, independent of result type.

#### Scenario: Match a partial query with omitted characters
- **WHEN** a user enters a query whose characters occur in order but are not contiguous in a result's searchable text
- **THEN** that result is included if every query token matches at least one searchable field

#### Scenario: Put the closest result first across result types
- **WHEN** an agent, task, and action all match a query with different match quality
- **THEN** the result with the strongest match appears first, regardless of its type

#### Scenario: Prefer a stronger match and keep ties deterministic
- **WHEN** multiple results match the same query
- **THEN** stronger matches precede weaker matches, and equally ranked results retain a deterministic order

#### Scenario: Do not show results when no query terms match
- **WHEN** a non-empty query has no matching agents, tasks, or actions
- **THEN** the palette shows its no-results state and does not show the empty-query navigation defaults

### Requirement: Keep ranked results usable with keyboard navigation
Argis SHALL keep every displayed fuzzy-search result reachable and activatable through the command palette's existing keyboard controls.

#### Scenario: Navigate and activate a ranked result
- **WHEN** a user moves through fuzzy-ranked results with the arrow keys and presses Enter on a result
- **THEN** the selected result is activated using its existing behavior
