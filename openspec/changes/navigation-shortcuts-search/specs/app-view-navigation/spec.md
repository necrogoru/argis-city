# Spec Delta

## Purpose

Provides predictable keyboard navigation between Argis's primary Dashboard and Tasks views while retaining the Dashboard as the default monitoring experience.

## ADDED Requirements

### Requirement: Switch primary views with keyboard shortcuts
Argis SHALL let users switch between Dashboard and Tasks using platform-appropriate modifier shortcuts, without changing the startup view.

#### Scenario: Switch views on macOS
- **WHEN** a user presses Command+1 or Command+2 outside a text-entry control or terminal
- **THEN** Argis shows Dashboard or Tasks, respectively

#### Scenario: Switch views on other platforms
- **WHEN** a user presses Control+1 or Control+2 outside a text-entry control or terminal
- **THEN** Argis shows Dashboard or Tasks, respectively

#### Scenario: Start in Dashboard
- **WHEN** Argis starts
- **THEN** Dashboard is the active view regardless of the last shortcut used

### Requirement: Navigation shortcuts do not interrupt text entry
Argis SHALL NOT use the Dashboard or Tasks navigation shortcuts to change views while the user is entering text in an editable control or terminal.

#### Scenario: Shortcut character is entered in a text field
- **WHEN** a user presses a view shortcut while focus is in a text-entry control
- **THEN** Argis keeps the current view and does not intercept the text-entry interaction

#### Scenario: Shortcut is entered in a terminal
- **WHEN** a user presses a view shortcut while focus is in an embedded terminal
- **THEN** Argis keeps the current view and allows the terminal to handle the keystroke
