# Spec Delta

## MODIFIED Requirements

### Requirement: Close the terminal modal with Escape
Argis SHALL close the terminal modal when Escape is pressed while it is open and focus is outside terminal input, without stopping its managed terminal processes. While terminal input is focused, plain Escape SHALL be passed to the terminal instead of closing the modal.

#### Scenario: Close an open terminal
- **WHEN** a user presses Escape in the terminal modal while focus is outside terminal input
- **THEN** the modal closes and its Agent/shell processes remain available for reattachment

#### Scenario: Pass Escape to terminal input
- **WHEN** a user presses plain Escape while terminal input is focused
- **THEN** the terminal receives Escape and the modal remains open

## ADDED Requirements

### Requirement: Close the terminal modal with Ctrl+Esc
Argis SHALL close the terminal modal when unmodified Ctrl+Esc is pressed while it is open, regardless of which control or terminal input has focus, without stopping its managed terminal processes. Ctrl+Shift+W SHALL NOT close the terminal modal.

#### Scenario: Close from terminal input
- **WHEN** a user presses Ctrl+Esc while terminal input is focused
- **THEN** the modal closes and its Agent/shell processes remain available for reattachment

#### Scenario: Close from a modal control
- **WHEN** a user presses Ctrl+Esc while a tab button, the close button, or another modal control has focus
- **THEN** the modal closes

#### Scenario: Legacy close chord no longer closes
- **WHEN** a user presses Ctrl+Shift+W while the terminal modal is open
- **THEN** the modal remains open and the chord is not handled as a close shortcut
