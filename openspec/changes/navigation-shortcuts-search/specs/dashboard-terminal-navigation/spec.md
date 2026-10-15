# Spec Delta

## Purpose

Makes Argis-managed task terminals visible and resumable from Dashboard while keeping terminal discovery scoped to sessions owned by Argis.

## ADDED Requirements

### Requirement: Dashboard exposes indexed Argis task terminals
Dashboard SHALL show one indexed launcher for each task terminal known to Argis, with a status indicator that uses the existing house-status visual language.

#### Scenario: Show managed task terminals
- **WHEN** one or more task terminals have been opened or have Argis-managed sessions
- **THEN** Dashboard shows one launcher per task, with a compact index and a state representing idle, pending, running, completed, or unavailable

#### Scenario: Do not discover external terminals
- **WHEN** a terminal process was not started or managed by Argis
- **THEN** it does not appear in the Dashboard terminal rail

### Requirement: Terminal launcher expands and opens the Agent tab
Each Dashboard terminal launcher SHALL reveal the task title on hover and open that task’s terminal modal with the Agent tab selected when activated.

#### Scenario: Expand a compact launcher
- **WHEN** the pointer hovers a compact indexed launcher
- **THEN** it expands to reveal the full task text without obscuring its status

#### Scenario: Open a task terminal
- **WHEN** a user activates a launcher
- **THEN** Argis opens the corresponding task’s terminal modal with the Agent tab selected

### Requirement: Selected house can reopen its matching task terminal
A selected-house summary SHALL show a Terminal action only when the house working directory matches a task worktree with an Argis-managed terminal.

#### Scenario: Open a matching task terminal from a house
- **WHEN** the selected house’s normalized working directory matches a task worktree that has an Argis-managed terminal
- **THEN** the summary offers Terminal and activation opens that task’s terminal modal

#### Scenario: No matching Argis terminal exists
- **WHEN** the selected house has no matching task worktree with an Argis-managed terminal
- **THEN** the summary does not show the Terminal action
