# Spec Delta

## Purpose

Provides predictable keyboard navigation through the task board’s status panes, with vertical movement constrained to a pane and Vim motions for reaching the first or last visible task.

## ADDED Requirements

### Requirement: Vertical navigation stays within the focused status pane
The task board SHALL move focus vertically only among visible tasks in the focused task’s status pane and SHALL NOT wrap or move focus into another pane at a pane boundary.

#### Scenario: Move down within a pane
- **WHEN** a task is focused and the user presses ArrowDown or `j` while another visible task follows it in the same pane
- **THEN** focus moves to that next task in the same pane

#### Scenario: Move up within a pane
- **WHEN** a task is focused and the user presses ArrowUp or `k` while another visible task precedes it in the same pane
- **THEN** focus moves to that previous task in the same pane

#### Scenario: Reach the bottom of a pane
- **WHEN** the last visible task in a pane is focused and the user presses ArrowDown or `j`
- **THEN** focus remains on that task and does not move to a task in another pane

#### Scenario: Reach the top of a pane
- **WHEN** the first visible task in a pane is focused and the user presses ArrowUp or `k`
- **THEN** focus remains on that task and does not move to a task in another pane

### Requirement: Vim motions jump to the first and last visible tasks
The task board SHALL support `gg` to focus the first visible task and uppercase `G` to focus the last visible task in the current filtered board order.

#### Scenario: Jump to the first visible task
- **WHEN** the user enters `gg` in the task board keyboard context
- **THEN** focus moves to the first visible task across the board’s panes

#### Scenario: Jump to the last visible task
- **WHEN** the user presses uppercase `G` in the task board keyboard context
- **THEN** focus moves to the last visible task across the board’s panes

#### Scenario: Apply search and project filters to a jump
- **WHEN** the user enters `gg` or presses uppercase `G` while search or project filters are active
- **THEN** focus moves to the first or last task in the filtered board order, respectively

#### Scenario: Jump when no tasks are visible
- **WHEN** the user enters `gg` or presses uppercase `G` and the board has no visible tasks
- **THEN** focus remains unchanged

### Requirement: Board navigation shortcuts do not take input from editors or dialogs
Task-board navigation shortcuts SHALL leave keystrokes to editable controls and SHALL be inactive while a dialog is open or a key event is composing text.

#### Scenario: Type in a text field
- **WHEN** the user presses a task-board navigation key while focus is in an input, textarea, select, contenteditable element, or terminal input
- **THEN** the board does not handle that key as navigation

#### Scenario: Navigate while a dialog is open
- **WHEN** the user presses a task-board navigation key while a dialog is open
- **THEN** the board does not move task focus

#### Scenario: Enter a composing key sequence
- **WHEN** a navigation key event is part of an active text composition
- **THEN** the board does not handle that event as navigation
