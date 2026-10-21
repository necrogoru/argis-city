# app-view-navigation Specification

## Purpose

Keeps Dashboard as Argis’s default monitoring view while avoiding numeric shortcuts that conflict with keyboard-first task workflows.

## Requirements

### Requirement: Dashboard remains the startup view
Argis SHALL start in Dashboard regardless of the most recently used primary view.

#### Scenario: Launch Argis
- **WHEN** Argis starts
- **THEN** Dashboard is the active view

### Requirement: Numeric shortcuts do not switch primary views
Argis SHALL NOT switch between Dashboard and Tasks in response to platform modifier+1 or modifier+2 shortcuts.

#### Scenario: Numeric shortcuts on macOS
- **WHEN** a user presses Command+1 or Command+2
- **THEN** Argis leaves the current primary view unchanged

#### Scenario: Numeric shortcuts on other platforms
- **WHEN** a user presses Control+1 or Control+2
- **THEN** Argis leaves the current primary view unchanged

### Requirement: G-prefixed chords switch primary views
Argis SHALL switch to Dashboard after the unmodified key sequence `g` then `d`, and to Tasks after `g` then `t`, when the second key follows within 500 ms. The sequence SHALL ignore modified, repeated, composing, or already-handled key events and SHALL clear an incomplete prefix when the next key is unrelated or the window expires.

#### Scenario: Open Dashboard from Tasks
- **WHEN** the Tasks workspace is active and a user presses `g` then `d` within 500 ms
- **THEN** Argis shows Dashboard

#### Scenario: Open Tasks from Dashboard
- **WHEN** Dashboard is active and a user presses `g` then `t` within 500 ms
- **THEN** Argis shows the Tasks workspace

#### Scenario: Expired prefix does not navigate
- **WHEN** a user presses `g`, waits longer than 500 ms, and then presses `d` or `t`
- **THEN** Argis does not switch primary views from that sequence

#### Scenario: Ignore modified, repeated, or composing keys
- **WHEN** either key in the sequence has Meta, Control, Alt, or Shift pressed, is repeated, or is part of an active composition
- **THEN** Argis does not treat the sequence as a view chord

#### Scenario: Unrelated key clears the prefix
- **WHEN** a user presses `g` and then a key other than `d` or `t`
- **THEN** Argis clears the pending `g` and does not navigate

### Requirement: View chords stay out of terminals, editors, and dialogs
Argis SHALL NOT start or complete a view chord while any modal dialog is open, including the command palette or terminal modal, or while focus is in an input, textarea, select, contenteditable element, or xterm input. A blocked key SHALL clear any pending `g`.

#### Scenario: Terminal modal is open
- **WHEN** the terminal modal is open and a user presses `g` then `d`
- **THEN** the terminal remains open, Dashboard is not activated, and the terminal continues to receive its normal input

#### Scenario: Text entry has focus
- **WHEN** focus is in an editable control or xterm input and a user presses `g` then `d` or `g` then `t`
- **THEN** Argis preserves text entry and leaves the active primary view unchanged

#### Scenario: Non-editable page control has focus
- **WHEN** focus is on a non-editable page control such as a button and no dialog is open
- **THEN** the view chords remain available

### Requirement: View chords take precedence over task-board single-key actions
Argis SHALL treat a completed view chord as handled so the Tasks board does not also run a single-key action from the chord's second key. The board's `gg` and `Shift+G` motions SHALL remain available when no view chord is pending.

#### Scenario: Do not open the focused task terminal
- **WHEN** the Tasks workspace has a focused task and the user presses `g` then `t` within 500 ms
- **THEN** Argis stays on Tasks and does not open that task's terminal or run another board action for `t`

#### Scenario: Leave Tasks without a board side effect
- **WHEN** the Tasks workspace has a focused task and the user presses `g` then `d` within 500 ms
- **THEN** Argis shows Dashboard without running a board action for the second key

#### Scenario: Preserve the board's first-task motion
- **WHEN** the Tasks workspace is active, no view chord is pending, and the user enters `gg`
- **THEN** focus moves to the first visible task as before
