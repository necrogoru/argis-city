# Project Task Management Specification

## Purpose

Provides a local, Argis-owned project and task catalog so users can organize planned work without changing or importing coding-agent plan data.

## Requirements

### Requirement: Projects are registered by local directory path
Argis SHALL let users add projects by entering a local directory path and SHALL allow each task to reference a registered project.

#### Scenario: Register an existing project directory
- **WHEN** a user adds an absolute path to an existing directory
- **THEN** Argis registers and displays that project without modifying the directory's contents

#### Scenario: Create a project directory that does not exist
- **WHEN** a user adds an absolute path whose parent exists and chooses to create the missing directory
- **THEN** Argis creates and registers that directory

#### Scenario: Reject an invalid project path
- **WHEN** a user submits a relative path or a path that cannot be validated or created
- **THEN** Argis reports the problem and does not register a project or create an unrelated directory

### Requirement: Tasks are user-authored and have stable generated identifiers
Argis SHALL let users create tasks assigned to a registered project, with a generated stable identifier, title, description, and initial pending status.

#### Scenario: Create a task
- **WHEN** a user creates a task for a registered project
- **THEN** Argis assigns a unique identifier, saves the title and description, and sets the task status to pending

#### Scenario: Edit task details
- **WHEN** a user edits a task's title or description
- **THEN** Argis saves the edit and preserves the task identifier

### Requirement: Task status changes are manual and ordered
Argis SHALL support the statuses pending, in progress, stopped, canceled, and completed in that order, and SHALL change status only through an explicit user action.

#### Scenario: Move a task to an adjacent status
- **WHEN** a user chooses the previous- or next-status action for a task
- **THEN** Argis moves the task by one position in the defined status order

#### Scenario: Disable status movement at sequence boundaries
- **WHEN** a task is pending and the user views its previous-status action, or a task is completed and the user views its next-status action
- **THEN** the corresponding action is disabled

### Requirement: The task board groups by status and filters by project
Argis SHALL show tasks in Pending, In progress, and Other statuses groups, preserve the exact status label for every task, and let users filter the board by project.

#### Scenario: Show tasks in the three status groups
- **WHEN** the task board is displayed
- **THEN** pending tasks appear in Pending, in-progress tasks appear in In progress, and stopped, canceled, and completed tasks appear in Other statuses with their distinct labels

#### Scenario: Filter the board by project
- **WHEN** a user selects a project filter
- **THEN** the board shows only tasks assigned to that project while retaining the status groups

### Requirement: Search tasks in the task workspace
The Tasks workspace SHALL search task identity and project context and filter the grouped board without changing task data.

#### Scenario: Filter tasks by query
- **WHEN** a user enters a query matching a task ID, title, description, project name, or project path
- **THEN** the board shows matching tasks in their existing status groups

#### Scenario: Search returns no tasks
- **WHEN** a query matches no task
- **THEN** the board shows a no-matches state and does not alter task data

### Requirement: Navigate matching tasks with arrow keys
The Tasks workspace SHALL let users move keyboard focus through matching tasks in visible board order.

#### Scenario: Move focus through filtered tasks
- **WHEN** a user presses ArrowDown or ArrowUp from task search or a focused task
- **THEN** focus moves to the adjacent matching task and remains within the filtered results

### Requirement: Invoke task actions with single-key shortcuts
In the Tasks workspace, `c` SHALL invoke the existing New task action, and `b`/`t` SHALL invoke the existing branch/terminal action for the focused task.

#### Scenario: Create a task from the keyboard
- **WHEN** a user presses `c` while task-workspace shortcuts are active
- **THEN** Argis opens the existing New task flow with the same project availability and validation as the button

#### Scenario: Branch or open the focused task
- **WHEN** a task is focused and the user presses `b` or `t`
- **THEN** Argis invokes that task’s existing branch or terminal action without bypassing its availability checks

#### Scenario: Focused task action is unavailable
- **WHEN** the focused task cannot create a branch or open a terminal
- **THEN** the shortcut has no side effect and the existing unavailable reason remains available

### Requirement: Keep single-key task actions out of text entry and dialogs
Argis SHALL NOT invoke `c`, `b`, or `t` task actions while focus is in an unrelated editable control or modal dialog.

#### Scenario: Type in a task search or editor field
- **WHEN** a user presses `c`, `b`, or `t` while entering text in a field
- **THEN** Argis preserves text entry and does not invoke a task action

### Requirement: Task deletion does not depend on Git cleanup
When a task has an associated branch or worktree, Argis SHALL ask whether to remove those resources during task deletion. If the task has active terminal processes, Argis SHALL stop and reap them before deleting the task or attempting Git cleanup. Task deletion SHALL proceed if Git cleanup is declined or fails, but SHALL abort if an active terminal process cannot be stopped.

#### Scenario: Delete a task and keep its Git resources
- **WHEN** a user confirms task deletion and chooses to keep its branch and worktree
- **THEN** Argis deletes the task record and leaves those Git resources untouched

#### Scenario: Delete a task when Git cleanup cannot complete
- **WHEN** a user confirms task deletion and chooses Git cleanup but the worktree cannot be safely removed
- **THEN** Argis deletes the task record, does not force-remove the worktree, and reports the remaining Git resource location

#### Scenario: Delete a task with active terminal sessions
- **WHEN** a user confirms deletion of a task with a running Agent or shell process
- **THEN** Argis stops and reaps those processes before Git cleanup or task-record deletion

#### Scenario: A terminal process cannot be stopped during task deletion
- **WHEN** Argis cannot stop and reap an active process for the task
- **THEN** Argis aborts deletion, preserves the task record and Git resources, and reports the process cleanup error

### Requirement: Task and project data remains local to Argis
Argis SHALL persist task and project records on the local machine and SHALL NOT import coding-agent plan entries as managed tasks.

#### Scenario: Restore local records after restart
- **WHEN** Argis restarts after projects and tasks have been saved
- **THEN** the saved projects and tasks remain available with their identifiers and statuses unchanged
