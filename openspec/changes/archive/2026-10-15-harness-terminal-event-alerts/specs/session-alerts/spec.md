# Spec Delta

## Purpose

Session alerts bring attention to approval requests and completed runs across provider-observed harnesses and Argis-managed task terminals, including when the user is viewing another part of the app.

## ADDED Requirements

### Requirement: Alert when an observed session needs approval
The system SHALL issue one sound and desktop notification when an observed agent session or subagent newly enters `awaitingApproval` after monitoring has been initialized.

#### Scenario: Existing session begins awaiting approval
- **WHEN** an observed session or subagent changes from another status to `awaitingApproval`
- **THEN** the system issues one approval alert identifying the harness and session

#### Scenario: A newly observed session is already awaiting approval
- **WHEN** a session or subagent first appears in a later snapshot as `awaitingApproval`
- **THEN** the system issues one approval alert

#### Scenario: App starts while approval is already pending
- **WHEN** the initial snapshot contains a session or subagent with `awaitingApproval`
- **THEN** the system records its status as the baseline without issuing an alert

### Requirement: Alert when an observed run completes
The system SHALL issue one sound and desktop notification when an observed session transitions from `running` to `idle` or `done`.

#### Scenario: Run becomes idle
- **WHEN** a previously observed running session changes to `idle`
- **THEN** the system issues one completion alert

#### Scenario: Run becomes done
- **WHEN** a previously observed running session changes to `done`
- **THEN** the system issues one completion alert

#### Scenario: Session errors or disappears
- **WHEN** a running session changes to `error` or is absent from a later snapshot
- **THEN** the system does not issue a completion alert

### Requirement: Alert when a managed terminal exits
The system SHALL issue one sound and desktop notification when an Argis-managed Agent or shell terminal process exits after it was observed running.

#### Scenario: Agent or shell exits
- **WHEN** a running managed terminal emits its process-exit event
- **THEN** the system issues one terminal-exit alert that identifies the task and terminal tab

#### Scenario: Completed terminal is reattached
- **WHEN** the UI reattaches to a terminal that had already exited
- **THEN** replayed exit state does not issue a new alert

### Requirement: Deliver alerts across app views
The system SHALL deliver qualifying alerts without requiring the dashboard, task workspace, or terminal modal to be visible.

#### Scenario: Event occurs while another view is active
- **WHEN** a qualifying event occurs while the user is viewing a different app view or the app is backgrounded
- **THEN** the system issues the desktop notification and audible cue

#### Scenario: Desktop notification permission is unavailable
- **WHEN** macOS notification permission is denied or unavailable
- **THEN** the system still plays the audible cue and does not repeatedly prompt for permission

### Requirement: Suppress duplicate alerts
The system SHALL issue at most one alert for each qualifying state transition or managed terminal exit.

#### Scenario: Snapshot repeats a status
- **WHEN** successive snapshots retain the same approval or completion status
- **THEN** the system does not repeat the alert

#### Scenario: Managed Agent completion is observed through both sources
- **WHEN** a managed Agent terminal exits and the same provider-observed session in the same normalized worktree also transitions to `idle` or `done`
- **THEN** the system issues one completion alert for that run

#### Scenario: Another harness completes in the same worktree
- **WHEN** an observed session in the same worktree completes but its provider differs from the managed Agent's selected CLI
- **THEN** the system does not deduplicate the independent completion alert
