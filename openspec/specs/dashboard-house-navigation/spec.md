# dashboard-house-navigation Specification

## Purpose

Lets Dashboard users browse houses in the 3D city with the keyboard and explicitly focus a house without relying on pointer selection.

## Requirements

### Requirement: Navigate a temporary house cursor
On Dashboard, Argis SHALL move a temporary house cursor with unmodified `h`/`l` or Left/Right Arrow without changing the selected house. Navigation SHALL follow provider order and then house order, wrapping at either end.

#### Scenario: Start navigating from the current selection
- **WHEN** a house is selected and the user presses `l` or Right Arrow with no active cursor
- **THEN** the cursor moves to the next house after the selected house and the selected house remains unchanged

#### Scenario: Start navigating with no selected house
- **WHEN** no house is selected or under the cursor and the user presses `l`/Right Arrow or `h`/Left Arrow
- **THEN** the cursor moves to the first or last house, respectively

#### Scenario: Navigate in stable order and wrap
- **WHEN** a cursor is active and the user presses `l`/Right Arrow or `h`/Left Arrow
- **THEN** the cursor moves to the next or previous house in provider order and house order, wrapping between the last and first houses

#### Scenario: No houses are available
- **WHEN** the Dashboard has no rendered houses and the user presses a house-navigation key
- **THEN** the cursor and selection remain unchanged

### Requirement: Show and announce the temporary house cursor
Argis SHALL distinguish the temporary house cursor from the selected house and make the cursor house's title and provider available to assistive technology.

#### Scenario: Browse to a house
- **WHEN** keyboard navigation moves the cursor to a house
- **THEN** the house receives visible keyboard-cursor feedback without replacing the selected-house marker, and its title and provider are announced

### Requirement: Enter focuses the cursor house
When a temporary house cursor is active, Enter SHALL select that house using the existing focused-house behavior and clear the temporary cursor.

#### Scenario: Commit a cursor house
- **WHEN** the user presses Enter with a house under the temporary cursor
- **THEN** that house becomes selected, its existing detail and camera focus behavior runs, and the temporary cursor is cleared

#### Scenario: Enter without a cursor
- **WHEN** the user presses Enter with no temporary house cursor
- **THEN** house navigation does not change the selection

### Requirement: Escape unfocuses the house
On Dashboard, Escape SHALL clear the temporary house cursor and preserve the existing one-layer selection escape behavior, which clears a selected house before clearing a focused provider.

#### Scenario: Escape while browsing
- **WHEN** a temporary house cursor is active and the user presses Escape
- **THEN** the cursor is cleared and any selected house is unfocused using the existing selection escape behavior

#### Scenario: Escape with a focused house and no cursor
- **WHEN** a house is selected and no temporary cursor is active
- **THEN** Escape unfocuses the selected house and leaves any provider focus intact

### Requirement: House shortcuts preserve other keyboard workflows
House navigation SHALL run only on Dashboard outside editable controls, open dialogs, and terminal inputs or the Dashboard terminal rail. It SHALL ignore modified, repeated, composing, and already-handled key events, and SHALL NOT prevent native activation of other focused controls.

#### Scenario: Preserve text entry and dialogs
- **WHEN** a house-navigation key or Enter is pressed while focus is in an editable control, terminal input, or open dialog
- **THEN** the house cursor and selection remain unchanged and the focused control or dialog retains its normal keyboard behavior

#### Scenario: Preserve terminal rail navigation
- **WHEN** focus is within the Dashboard terminal rail and the user presses a house-navigation key or Enter
- **THEN** house navigation does not handle the key and the rail retains its existing behavior

#### Scenario: Ignore ineligible key events
- **WHEN** a house-navigation key or Enter event is modified, repeated, composing, or already handled
- **THEN** house navigation does not change its cursor or selection
