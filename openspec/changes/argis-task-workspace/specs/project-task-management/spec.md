# Spec Delta

## Purpose

Provides a local, Argis-owned project and task catalog so users can organize planned work without changing or importing coding-agent plan data.

## ADDED Requirements

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
