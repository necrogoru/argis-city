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
