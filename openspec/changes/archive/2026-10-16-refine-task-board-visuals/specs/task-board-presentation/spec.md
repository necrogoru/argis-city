# Spec Delta

## Purpose

Defines how the Tasks board presents status groups, task-state cues, and keyboard guidance so users can scan and navigate work without changing the rest of Argis's visual system.

## ADDED Requirements

### Requirement: Status groups use open visual lanes
The Tasks board SHALL group tasks into three visually distinct lanes using headings, counts, consistent gutters, and whitespace rather than enclosing each lane in an additional bordered panel.

#### Scenario: Display the task board
- **WHEN** the Tasks board displays its status groups
- **THEN** Pending, In progress, and Other statuses appear as evenly distributed lanes with consistent spacing and no enclosing lane frames

### Requirement: Task status cues use consistent semantic colors
The Tasks board SHALL retain each task's exact status label and use the established semantic color for that status without tinting the entire task card.

#### Scenario: Display task states
- **WHEN** tasks with different statuses are visible
- **THEN** Pending is neutral, In progress is teal, Stopped is amber, Canceled is red, and Completed is blue in their status cues

### Requirement: Task-board text maintains readable contrast
Normal-size text in the Tasks board SHALL have a contrast ratio of at least 4.5:1 against its rendered background.

#### Scenario: Read task metadata and status labels
- **WHEN** task titles, metadata, lane headings, or status labels are displayed
- **THEN** each text foreground meets at least 4.5:1 contrast against its background

### Requirement: Status changes receive restrained visual feedback
When a task status changes, the Tasks board SHALL provide brief visual feedback that does not shift the card's layout and SHALL suppress the transition for users who prefer reduced motion.

#### Scenario: Show feedback after a status change
- **WHEN** a user changes a task's status
- **THEN** the status cue briefly transitions to its new semantic treatment without changing the card's size or position

#### Scenario: Respect reduced-motion preference
- **WHEN** the operating system requests reduced motion
- **THEN** status changes update without an animated transition

### Requirement: Keyboard shortcuts remain visibly discoverable
While the Tasks view is open, Argis SHALL keep a visible shortcut legend on screen that accurately describes the task board's supported navigation and action shortcuts.

#### Scenario: Show the complete shortcut legend
- **WHEN** the Tasks view is open, whether or not a task is focused or matches the current filters
- **THEN** the visible legend identifies `ArrowUp`/`ArrowDown` and `j`/`k` for movement within a lane, `ArrowLeft`/`ArrowRight` and `h`/`l` for movement between lanes, `gg` and `Shift+G` for first/last task, and `c`/`b`/`t` for task actions

#### Scenario: Fit the legend in a narrow window
- **WHEN** the Tasks view is narrower than the desktop layout
- **THEN** the shortcut legend wraps as needed without horizontal overflow or hiding its shortcut labels
