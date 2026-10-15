# Tasks

## 1. Palette action and availability

- [x] 1.1 Add a searchable Create task command whose enabled state follows registered-project availability, and cover matching plus reactive availability in unit tests.
- [x] 1.2 Render disabled command semantics and prevent both pointer and Enter activation; verify the shared activation guard with unit tests and confirm the option exposes its disabled state accessibly.

## 2. Task editor handoff

- [x] 2.1 Add a one-shot task-creation request to app-view state and have TaskBoard consume it to open the existing New task editor; verify request delivery when Tasks is already active and when switching from Dashboard.
- [x] 2.2 Preserve the existing editor's project selection, validation, save, and cancel behavior; verify the command submits no task before the user saves and the existing task-store tests remain green.

## 3. Integrated verification

- [x] 3.1 Run `pnpm build` and `pnpm exec vitest run`; verify palette search and disabled behavior with and without a registered project, and confirm selecting Create task from Dashboard and Tasks opens the existing editor without creating a task prematurely.
