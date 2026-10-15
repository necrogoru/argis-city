# command-palette-search Specification

## Purpose

Lets users find project tasks and open their embedded terminals through Argis's command palette, without first navigating away from Dashboard or interrupting agent monitoring.

## Requirements

### Requirement: Navigate primary views from the command palette
The command palette SHALL provide searchable actions for switching to Dashboard and Tasks.

#### Scenario: Find and open Dashboard
- **WHEN** a user searches for Dashboard or city navigation in the command palette and selects the Dashboard action
- **THEN** Argis shows Dashboard without changing its startup behavior or monitoring state

#### Scenario: Find and open Tasks
- **WHEN** a user searches for Tasks or workspace navigation in the command palette and selects the Tasks action
- **THEN** Argis shows the Tasks workspace

### Requirement: Search tasks from the command palette
The command palette SHALL search Argis tasks by task identity and project context and present matching tasks without requiring the user to open the Tasks workspace.

#### Scenario: Find a task by its details
- **WHEN** a user enters text matching a task ID, title, description, or project path in the command palette
- **THEN** Argis shows the matching task with enough project and status context to identify it

#### Scenario: Search has no task matches
- **WHEN** a user's query matches no task
- **THEN** Argis shows no task results and keeps the other matching palette results available

### Requirement: Open a task terminal from a search result
For a task with an associated worktree, Argis SHALL open that task's embedded terminal over the current view when the user selects its terminal action in the command palette.

#### Scenario: Reopen a task with running terminal sessions
- **WHEN** a user selects a task that has one or more running terminal sessions
- **THEN** Argis opens the task terminal without switching to Tasks and reattaches to the existing sessions

#### Scenario: Open a task terminal with no running session
- **WHEN** a user selects a task with a worktree but no running terminal session
- **THEN** Argis opens the task terminal without switching views and presents the existing Agent and shell start controls

### Requirement: Explain terminal unavailability for tasks without worktrees
Argis SHALL keep tasks without worktrees searchable, explain that a worktree is required to open a terminal, and provide an explicit action to open the Tasks workspace.

#### Scenario: Find a task without a worktree
- **WHEN** a user searches for a task that has no associated worktree
- **THEN** Argis shows the task, explains why its terminal is unavailable, and offers an explicit action that navigates to Tasks

#### Scenario: Do not create a worktree during search
- **WHEN** a user searches for or selects a task without a worktree
- **THEN** Argis does not create a Git branch or worktree unless the user separately chooses an explicit worktree-creation action

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
