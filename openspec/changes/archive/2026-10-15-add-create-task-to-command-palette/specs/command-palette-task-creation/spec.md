# Spec Delta

## Purpose

Lets users start Argis's existing project-assigned task creation flow from the command palette while preserving the same project requirement and explicit save behavior as the Tasks workspace.

## ADDED Requirements

### Requirement: Start task creation from the command palette
The command palette SHALL provide a searchable Create task action that opens the existing New task editor in the Tasks workspace without creating a task until the user submits the form.

#### Scenario: Create task from Dashboard
- **WHEN** a user searches for and selects Create task from Dashboard while at least one project is registered
- **THEN** Argis shows the Tasks workspace and opens the existing New task editor
- **AND** no task is created until the user submits the editor

#### Scenario: Create task while already in Tasks
- **WHEN** a user searches for and selects Create task while the Tasks workspace is already active and at least one project is registered
- **THEN** Argis opens the existing New task editor without navigating away from Tasks

### Requirement: Respect project availability for palette task creation
The command palette SHALL keep Create task discoverable but disabled when no project is registered, and activation of the disabled action SHALL have no effect.

#### Scenario: No registered projects
- **WHEN** a user searches for Create task and no project is registered
- **THEN** the palette shows the action as disabled and does not open the editor or change views when the user activates it

#### Scenario: A project becomes available
- **WHEN** a project is registered while the command palette is open
- **THEN** Create task becomes enabled and opens the existing New task editor when selected
