# Spec Delta

## Purpose

Lets users run an interactive coding agent and shell inside Argis at a task's isolated worktree while keeping terminal sessions available as they move between Argis views.

## ADDED Requirements

### Requirement: Open a two-tab terminal for a task worktree
Argis SHALL open an embedded terminal in a large modal or panel over the task workspace with an Agent tab and a `term` shell tab, both rooted at the task worktree.

#### Scenario: Open a task terminal
- **WHEN** a user opens the terminal for a task with an associated worktree
- **THEN** Argis displays the Agent and `term` tabs rooted at that worktree without launching an external terminal application

#### Scenario: Terminal is unavailable before worktree creation
- **WHEN** a user views the terminal action for a task without an associated worktree
- **THEN** the action is disabled with an explanation that the task worktree must be created first

### Requirement: Select an agent CLI for the Agent tab
When starting a new Agent tab, Argis SHALL ask which supported coding-agent CLI to launch, default the selection to Claude Code, and start the chosen CLI in the task worktree.

#### Scenario: Launch the default agent
- **WHEN** a user accepts the default agent selection
- **THEN** Argis starts Claude Code in the task worktree

#### Scenario: Launch another supported agent
- **WHEN** a user selects another supported coding-agent CLI
- **THEN** Argis starts that CLI in the task worktree

#### Scenario: Selected CLI is unavailable
- **WHEN** the selected CLI executable cannot be started
- **THEN** Argis shows an error in the Agent tab while leaving the `term` shell tab usable

### Requirement: Terminal tabs provide interactive processes
Argis SHALL provide interactive input and output for the Agent and shell processes in their respective terminal tabs.

#### Scenario: Use the shell tab
- **WHEN** a user types a command in the `term` tab
- **THEN** Argis sends the input to an interactive shell whose working directory is the task worktree and displays its output

#### Scenario: Use the Agent tab
- **WHEN** a user interacts with the selected agent in the Agent tab
- **THEN** Argis sends input to and displays output from that agent process in the task worktree

### Requirement: Close the terminal modal with Escape
Argis SHALL close the terminal modal when Escape is pressed while it is open, without stopping its managed terminal processes.

#### Scenario: Close an open terminal
- **WHEN** a user presses Escape in the terminal modal
- **THEN** the modal closes and its Agent/shell processes remain available for reattachment

### Requirement: Switch terminal tabs and focus their input with Ctrl+Tab
While the terminal modal is open, Ctrl+Tab SHALL toggle between the Agent and `term` tabs and focus the active tab’s terminal input.

#### Scenario: Open the terminal modal
- **WHEN** a task terminal modal opens
- **THEN** the Agent tab is active and its terminal input receives focus

#### Scenario: Switch from Agent to shell
- **WHEN** the Agent tab is active and a user presses Ctrl+Tab
- **THEN** the `term` tab becomes active and its terminal input receives focus

#### Scenario: Switch from shell to Agent
- **WHEN** the `term` tab is active and a user presses Ctrl+Tab
- **THEN** the Agent tab becomes active and its terminal input receives focus

### Requirement: Preserve terminal sessions while Argis is open
Argis SHALL keep task terminal processes running when users close the terminal modal or switch to monitoring, reconnect tabs to their still-running processes with retained recent output, and SHALL stop those processes when Argis exits or their owning task is deleted.

#### Scenario: Return to a running terminal
- **WHEN** a user closes the terminal modal or switches back to the city and later reopens the task terminal
- **THEN** Argis reconnects the tabs to their still-running processes, restores retained terminal output before live output, and shows the current terminal contents

#### Scenario: Exit Argis
- **WHEN** Argis exits
- **THEN** Argis terminates the terminal processes it manages

#### Scenario: Delete a task with active terminal processes
- **WHEN** a user confirms deletion of a task with active terminal processes
- **THEN** Argis stops and reaps the task's processes before Git cleanup and task-record deletion
