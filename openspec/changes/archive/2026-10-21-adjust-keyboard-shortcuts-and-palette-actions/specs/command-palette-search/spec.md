# Spec Delta

## MODIFIED Requirements

### Requirement: Show primary navigation actions for an empty query
When the command palette query is empty, Argis SHALL show the Open Tasks, Show Dashboard, and Create task actions, in that order.

#### Scenario: Open the palette without typing
- **WHEN** a user opens the command palette with an empty query
- **THEN** Open Tasks appears first, Show Dashboard second, and Create task third, with no agent, task, or other action results

#### Scenario: Restore defaults after clearing a query
- **WHEN** a user clears all text from a non-empty command palette query
- **THEN** the palette returns to Open Tasks, Show Dashboard, and Create task in that order

#### Scenario: Create task is unavailable
- **WHEN** the palette shows its empty-query defaults while no project is registered
- **THEN** Create task remains listed as disabled and activation has no effect
