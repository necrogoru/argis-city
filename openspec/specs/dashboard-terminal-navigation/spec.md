# dashboard-terminal-navigation Specification

## Purpose

Makes Argis-managed task terminals visible and resumable from Dashboard while keeping terminal discovery scoped to sessions owned by Argis.

## Requirements

### Requirement: Dashboard rail shows In progress tasks
Dashboard SHALL show one indexed launcher for each task whose workflow status is In progress, regardless of its terminal-session lifecycle state. This filter SHALL affect only the rail presentation and SHALL NOT remove managed terminal targets from selected-house matching.

#### Scenario: Show only In progress tasks
- **WHEN** the Dashboard rail is displayed while tasks have different workflow statuses
- **THEN** it shows one launcher per In progress task, including tasks with no active terminal session, and omits Pending, Stopped, Canceled, and Completed tasks even when they have an active terminal session

#### Scenario: Do not discover external terminals
- **WHEN** a terminal process was not started or managed by Argis
- **THEN** it does not appear in the Dashboard terminal rail

### Requirement: Terminal launcher previews task context and opens the Agent tab
Each Dashboard terminal launcher SHALL show the first 10 characters of the task title in its compact label, reveal the full title and aggregate terminal state on hover or keyboard focus, and expose the full title and state in its accessible name. Activating a launcher SHALL open that task’s terminal modal with the Agent tab selected.

#### Scenario: Preview and expand a compact launcher
- **WHEN** a launcher is displayed or receives pointer/keyboard focus
- **THEN** its compact label shows up to the first 10 title characters, and its expanded/focused presentation reveals the full title and aggregate terminal state

#### Scenario: Open a task terminal
- **WHEN** a user activates a launcher
- **THEN** Argis opens the corresponding task’s terminal modal with the Agent tab selected

### Requirement: Expand only the active launcher
A launcher SHALL expand only while it is the active launcher (pointer-hovered or keyboard-focused), and expanding it SHALL NOT move, resize, or expand any other launcher on the rail.

#### Scenario: Expand a launcher without moving its neighbours
- **WHEN** the pointer hovers a launcher or keyboard focus moves onto it
- **THEN** only that launcher expands leftwards and every other launcher keeps its compact size and position

#### Scenario: One active launcher at a time
- **WHEN** hover and keyboard focus would otherwise land on different launchers
- **THEN** only the tracked active launcher is expanded — the hovered one while the pointer is inside the rail, otherwise the focused one — never two at once

### Requirement: Navigate Dashboard rail tasks with the keyboard
From Dashboard, an unmodified `g` then `r` within 500 ms SHALL move keyboard focus to the first visible launcher without changing the active view or opening a terminal. When focus is within the Dashboard task rail, Argis SHALL move focus through the visible launchers in display order with ArrowDown or `j` for the next task and ArrowUp or `k` for the previous task, wrapping at either end. Enter SHALL activate the focused launcher using the existing terminal-navigation behavior without changing the active view or starting a terminal process by itself.

#### Scenario: Jump into the rail from Dashboard
- **WHEN** a user presses `g` then `r` within 500 ms on Dashboard with no modal dialog open and focus outside editable controls
- **THEN** keyboard focus moves to the first visible In progress launcher and the active view stays Dashboard

#### Scenario: Ignore the rail chord elsewhere or while typing
- **WHEN** the user presses `g` then `r` with a modal dialog open, in an editable control, or in terminal input
- **THEN** Argis neither starts the chord nor moves focus into the rail

#### Scenario: Move focus through visible tasks
- **WHEN** a user presses ArrowDown/`j` or ArrowUp/`k` while a rail launcher is focused
- **THEN** focus moves to the next or previous visible In progress task, wrapping at the ends

#### Scenario: Open the focused task terminal
- **WHEN** a user presses Enter while a rail launcher is focused
- **THEN** Argis opens that task’s terminal modal with the Agent tab selected and leaves the Dashboard active beneath it

#### Scenario: Do not intercept keys outside the rail
- **WHEN** a user presses `j` or `k` outside the focused rail, or types in an editable control
- **THEN** Argis does not move rail focus or suppress text entry

### Requirement: Selected house can reopen its matching task terminal
A selected-house summary SHALL show a Terminal action only when the house working directory matches a task worktree with an Argis-managed terminal.

#### Scenario: Open a matching task terminal from a house
- **WHEN** the selected house’s normalized working directory matches a task worktree that has an Argis-managed terminal, even if the task is not In progress
- **THEN** the summary offers Terminal and activation opens that task’s terminal modal

#### Scenario: No matching Argis terminal exists
- **WHEN** the selected house has no matching task worktree with an Argis-managed terminal
- **THEN** the summary does not show the Terminal action
