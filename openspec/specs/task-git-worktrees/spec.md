# Task Git Worktrees Specification

## Purpose

Provides explicit, task-scoped Git branches and worktrees so users can start agent work in an isolated checkout of a registered project.

## Requirements

### Requirement: Create a task branch and worktree together
For a task in a Git working tree, Argis SHALL create a branch named `argis/<task-id>-<title-slug>` and a worktree at `<project>/.argis/worktrees/<task-id>-<title-slug>` from the user's explicit create action.

#### Scenario: Create an available task worktree
- **WHEN** the user creates a branch for a task whose project is a Git working tree and the generated branch name is unused
- **THEN** Argis creates the branch and worktree at the specified names and associates the worktree path with the task

#### Scenario: Keep the task branch stable when its title changes
- **WHEN** a user edits a task title after its branch and worktree are created
- **THEN** Argis preserves the existing branch name and worktree path

### Requirement: Disable branch creation when Git is unavailable or the branch exists
Argis SHALL disable task branch creation when the project is not a Git working tree or the generated branch already exists, explain why, and SHALL NOT initialize Git automatically.

#### Scenario: Project is not a Git working tree
- **WHEN** a user views branch creation for a task whose project is not a Git working tree
- **THEN** the action is disabled with an explanation that Git must be initialized or cloned first

#### Scenario: Generated branch already exists
- **WHEN** a user views branch creation for a task whose generated branch already exists
- **THEN** the action is disabled and Argis does not create another worktree or branch

### Requirement: Keep generated worktrees out of tracked project changes
Argis SHALL add `.argis/worktrees/` to the repository-local `.git/info/exclude` without overwriting existing entries or modifying tracked ignore files.

#### Scenario: Add the local exclusion rule
- **WHEN** Argis prepares to create a task worktree
- **THEN** it ensures the local exclude file contains `.argis/worktrees/` and leaves tracked project files unchanged

### Requirement: Git operations preserve user data
Argis SHALL invoke Git using validated paths and discrete arguments, SHALL NOT interpolate task content into shell commands, and SHALL NOT force-remove worktrees during task cleanup.

#### Scenario: Task content contains shell metacharacters
- **WHEN** a task title contains shell metacharacters and Argis creates its branch or worktree
- **THEN** the title is normalized as a branch-name slug and is not executed as shell input

#### Scenario: Worktree has uncommitted changes during cleanup
- **WHEN** a user requests cleanup of a task worktree containing changes Git will not safely remove
- **THEN** Argis leaves the worktree and branch in place and reports their location without force-removing them
