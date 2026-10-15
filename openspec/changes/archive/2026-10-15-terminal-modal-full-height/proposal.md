# Proposal

## Why

The task terminal modal currently caps its height at 760px on larger windows and leaves viewport margins on smaller windows, limiting the space available to read and use terminal output. Expanding it to the full app-window height gives terminal sessions the room the user needs.

## What Changes

- Make the task terminal modal fill the app window vertically instead of capping its height or retaining top/bottom viewport margins.
- Preserve the existing modal content, controls, and horizontal sizing behavior; the requested change is vertical space only.
- Update the terminal modal layout specification to describe the full-height behavior.

## Capabilities

### New Capabilities

- `embedded-terminal-layout`: Defines how the task terminal modal uses and adapts to the app window's available space.

### Modified Capabilities

None. The existing terminal-session capability is currently defined only in the separate `argis-task-workspace` change, not in the archived spec inventory.

## Impact

- `src/ui/Tasks/TerminalModal.css`: modal height and vertical positioning at desktop and narrow viewport sizes.
- `docs/design/SPEC.md`: terminal modal layout description.
- `openspec/changes/terminal-modal-full-height/specs/embedded-terminal-layout/spec.md`: new capability spec for modal sizing, alongside the terminal-session behavior currently defined by `argis-task-workspace`.
