# Spec Delta

## Purpose

Defines how Argis presents the embedded task terminal within the available app-window space so terminal sessions have room to display and use their output.

## ADDED Requirements

### Requirement: Fill the available app-window height
The task terminal modal SHALL occupy the full available vertical space of the Argis app window without a fixed maximum height or reserved top and bottom margins, while keeping its terminal viewport in the modal's remaining content area.

#### Scenario: Open a terminal in a tall app window
- **WHEN** a user opens a task terminal in an app window taller than the modal's previous height limit
- **THEN** the modal reaches the top and bottom of the app window and the terminal viewport uses the additional available space

#### Scenario: Open a terminal in a constrained app window
- **WHEN** a user opens a task terminal in a short or narrow app window
- **THEN** the modal fills the app window vertically instead of leaving top and bottom margins, and the terminal viewport occupies the space remaining between the modal controls
