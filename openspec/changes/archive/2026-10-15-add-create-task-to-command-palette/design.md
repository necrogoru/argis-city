# Design

## Context

See `proposal.md` for motivation and `specs/command-palette-task-creation/spec.md` for user-visible requirements. The palette renders app commands as `CommandAction` options, while task creation currently lives in `TaskBoard` and its editor is mounted only when the Tasks view is active. The palette already loads task/project search data, and the board already disables New task when its project list is empty.

## Goals / Non-Goals

**Goals:**
- Reuse the existing task editor, validation, persistence, and project selection.
- Support launching creation from either primary view without losing the user's normal submit/cancel behavior.
- Keep the action discoverable and expose its unavailable state accessibly when no project exists.

**Non-Goals:**
- Creating tasks directly from palette text or bypassing the editor.
- Changing task fields, project management, backend commands, or the Tasks board layout.
- Adding new dependencies, app-wide visual tokens, or a second task-creation implementation.

## Decisions

- **Represent Create task as a normal searchable palette action.** This preserves action matching, keyboard navigation, and existing row presentation rather than introducing a separate creation section. Add an explicit disabled state to action options; render it accessibly and block both pointer and Enter activation while retaining discoverability.
- **Use the existing project availability rule.** Derive availability from the loaded task store's registered projects, so the command follows the board's current `projectCount > 0` behavior. While project data is loading or unavailable, keep the action non-activatable rather than opening an editor that cannot be submitted.
- **Pass a one-shot creation request through app-view state.** The action requests task creation and switches to Tasks. `TaskBoard` consumes the request after it is mounted and opens its existing editor. This handles both an already-mounted board and the conditional view transition from Dashboard without duplicating form state or coupling the palette to the dialog internals.
- **Keep presentation within the approved palette design.** Reuse the current Actions row and tokens; only add a disabled treatment consistent with existing disabled controls. Do not alter palette geometry, typography, or color tokens.

## Risks / Trade-offs

- [The board may mount after the request is made] → Store the request as observable one-shot state and consume it on board mount as well as while already mounted.
- [Project data may still be loading when the palette first opens] → Keep Create task disabled until the existing `ensureSearchDataLoaded` flow resolves; update availability reactively when projects arrive.
- [Disabled commands can be accidentally invoked through one input path] → Guard activation in the shared option runner and expose disabled semantics in the rendered option, covering click and Enter consistently.
