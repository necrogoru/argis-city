# Task Terminal Resumption Specification

## Purpose

Lets users continue a task's coding-agent conversation after its terminal process or Argis has exited, while keeping resume behavior tied to the correct task, worktree, and supported agent CLI.

## Requirements

### Requirement: Persist resumable task-agent references
Argis SHALL persist a provider-native reference for a task's agent conversation when the selected CLI exposes a resumable session that Argis can identify.

#### Scenario: Record an identified agent session
- **WHEN** an agent CLI starts or resumes a conversation and Argis can identify its native resume reference
- **THEN** Argis stores that reference with the task, provider, and task worktree so it survives an Argis restart

#### Scenario: CLI session cannot be identified
- **WHEN** an agent CLI starts but Argis cannot obtain a valid native resume reference
- **THEN** Argis does not claim the conversation is resumable and keeps the new-session action available

### Requirement: Offer resume or start-new choice
When no live Argis-managed Agent process exists for a task, Argis SHALL offer an explicit choice between resuming its latest valid saved agent conversation and starting a new conversation; the resume action SHALL identify the CLI it will launch.

#### Scenario: Reopen a live Agent process
- **WHEN** the task already has a live Argis-managed Agent process
- **THEN** Argis reattaches to that process without prompting to resume or start new

#### Scenario: Open a task with a saved resumable conversation
- **WHEN** the user opens the task Agent terminal with no live process and a valid saved reference
- **THEN** Argis offers Resume and Start new before launching an agent process

#### Scenario: Resume the saved conversation
- **WHEN** the user chooses Resume
- **THEN** Argis launches the recorded CLI in the validated task worktree using that provider's native resume behavior

#### Scenario: Start a new conversation instead
- **WHEN** the user chooses Start new
- **THEN** Argis starts a fresh conversation using the selected supported CLI and does not silently resume the saved conversation

#### Scenario: No supported resume reference exists
- **WHEN** the user opens the task Agent terminal without a valid reference or the recorded CLI cannot resume it
- **THEN** Argis explains that resume is unavailable and still offers starting a new conversation

### Requirement: Use the same resume flow from task terminal entry points
The task-board `t` shortcut, Dashboard terminal launcher, and selected-house Terminal action SHALL open the same task-scoped terminal modal without changing the current app view, with the Agent resume flow available in its Agent tab.

#### Scenario: Open through the task-board shortcut
- **WHEN** the user presses `t` for a task with a worktree
- **THEN** Argis opens that task's terminal modal on its `term` tab

#### Scenario: Open through the Dashboard launcher
- **WHEN** the user activates a Dashboard launcher for a task with a saved resumable conversation
- **THEN** Argis opens that task's terminal modal, and its Agent tab identifies the saved CLI session

#### Scenario: Open through a matching selected house
- **WHEN** the selected house matches a task worktree with a saved resumable conversation
- **THEN** the Terminal action opens the same task's terminal modal on its `term` tab

### Requirement: Keep resumable tasks discoverable after restart
The Dashboard SHALL show a launcher for each task with a valid saved agent reference even when no terminal process is currently running, and SHALL continue to exclude terminals not managed by Argis.

#### Scenario: Reopen Argis with a resumable task
- **WHEN** Argis starts and a task has a valid saved agent reference
- **THEN** the Dashboard launcher represents that task as resumable and opens its resume flow when activated

#### Scenario: Saved reference is stale or its worktree is unavailable
- **WHEN** Argis cannot validate a saved reference against the task's current worktree or the provider reports it cannot resume
- **THEN** Argis marks resume unavailable, does not launch the saved conversation in another directory, and still offers a new conversation (in the worktree root when the worktree directory was deleted)

### Requirement: Preserve process cleanup and task deletion safety
Resuming a saved conversation SHALL launch a new CLI process rather than restore an old PTY, and deleting its task SHALL remove its saved references after managed processes are stopped.

#### Scenario: Quit and relaunch Argis
- **WHEN** Argis exits while a task agent is running and the user later resumes its saved conversation
- **THEN** Argis stops the old managed PTY on exit and launches a new PTY using the saved native conversation reference, without claiming to restore the old terminal buffer

#### Scenario: Delete a task with saved references
- **WHEN** a task is deleted after managed terminal processes are stopped
- **THEN** Argis removes that task's saved agent references along with its task record
