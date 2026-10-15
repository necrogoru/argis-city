# Spec Delta

## Purpose

Keeps Dashboard as Argis’s default monitoring view while avoiding numeric shortcuts that conflict with keyboard-first task workflows.

## ADDED Requirements

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
