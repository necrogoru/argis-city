# Argis UI spec (approved Pencil design "Agent City — Overview", 1440×900)

## Tokens
| token     | value       | use                                   |
| --------- | ----------- | ------------------------------------- |
| bg        | `#0A0B0C`   | app background / scene clear color    |
| surface   | `#111314EB` | glass panels (+ backdrop blur 16–24)  |
| border    | `#FFFFFF14` | 1px panel/button strokes              |
| text      | `#F2F5F4`   | primary text                          |
| text-2    | `#8E9794`   | secondary                             |
| text-3    | `#7A8380`   | labels, captions (4.8:1 on panels)    |
| teal      | `#32F3E2`   | Claude Code, running, primary action  |
| blue      | `#67A2FD`   | Codex, done                           |
| amber     | `#FFB662`   | OpenCode, awaiting approval           |
| violet    | `#B98CFF`   | Pi                                    |
| idle grey | `#8E9794`   | idle                                  |

Font: **Outfit** (Google Fonts; stand-in for Gilroy) 400/500/600.
Radii: buttons 14, panels 24, cards 16, pills 7–8. Letter-spaced caps labels
(11px, +1.5 tracking, text-3) for section titles ("DISTRICTS", "CURRENT STEP").

## Layout (absolute overlay on a full-bleed 3D canvas)
- **Scene**: full window, isometric orthographic camera, black matte ground
  with faint diagonal street lines, radial vignette at the edges and a left
  scrim (bg 94% → 0% over the first ~36% width) so the hero text reads.
- **Top bar** (x 40, y 16, h 80, full width − 80; centre line y 56): brand
  (80px Panoptes mark — the app icon, a short ripple-and-blink beat every 10s
  while the window is focused — + "Argis" 44/500) · KPIs (icon + 12px label
  over 16/500 value: Active agents, Subagents, Tokens today/total, Needs you
  [amber icon; a button that opens the Agents list filtered to "Needs you"])
  · right: search field (260×48 glass, search icon,
  "Search agents, tasks & actions" text-3, `⌘K` key cap; Ctrl K off macOS), Tasks
  icon button, "Live · scanning 2s" teal-tinted pill with glowing dot, settings
  button.
- **Command palette** (click the Dashboard search trigger or press ⌘K/Ctrl+K
  from either primary view; the shortcut toggles it closed and Esc closes it):
  640px glass modal, 112px from the top over a dimmed, blurred backdrop. 60px
  search row, then an "ACTIONS" section containing only Open Tasks and Show
  Dashboard, in that order, while the query is empty. After typing, show one
  globally ranked "RESULTS" section mixing agents, tasks, and actions. Search is
  case-insensitive and whitespace-tokenized; each token may match as an ordered
  subsequence of a searchable field, with stronger/closer matches first and
  deterministic ties. Agent rows use a status dot, highlighted title,
  `provider · model · ~/dir`, and status pill. Task rows match task ID, title,
  description, and project path, and show `#id · project · status` plus an Open
  terminal action when a worktree exists; without a worktree, show
  "No worktree · Go to Tasks". Actions include Show Dashboard and Open Tasks,
  selected-agent actions (open folder, copy path, close details), district and
  city navigation, camera moves, and refresh. No-match copy covers agents,
  tasks, and actions. ↑↓ moves through the results (wraps), ↵ runs the selected
  result, hover moves the cursor; matches are teal. Footer with key hints.
- **Hero** (x 40, y 124, w 300): "Agent\nInfrastructure" 36/400, lh 1.08,
  tracking −1; 14px text-2 description; "DISTRICTS" list: rows with 10px
  rounded swatch, provider name, "N houses" right (text-3); selected row has
  `#FFFFFF0D` fill. Rows filter/focus the camera on that tower.
- **Camera controls** (x 40, bottom-left above the strip): 44px round glass
  buttons: zoom in, zoom out, reset/rotate, fit. Keys (Ctrl off macOS):
  ⌘+ or ⌘= zooms in, ⌘− zooms out, ⌘0 fits; holding repeats.
- **Tower labels** (in-scene HTML): glass pill (swatch + name + count chip),
  thin gradient line down to a glowing anchor dot on the tower top. The
  selected tower's pill has a 1px provider-colour stroke.
- **Selected house marker**: solid teal callout ("house icon tile + `title ·
  68%`", dark text 600), 26px line, 22px ring on the house.
- **Agents list** (right column, same frame as the detail panel, shown while
  nothing is selected): "Agents N" title, status filter chips (Needs you ·
  Error · Running · Idle · Done, non-zero only), then rows grouped by
  provider: status accent + dot, title, `model · elapsed`, progress readout
  and a subagent badge (amber hand + count when a subagent waits on the
  user). "Needs you" rows (the session or one of its subagents awaits
  approval) sort first and get an amber-tinted fill.
- **Dashboard terminal rail**: a compact, indexed vertical rail just left of
  the right column, visible beside both the Agents list and selected-house
  panel. It shows one launcher per task whose workflow status is In progress,
  including tasks with no active terminal session, and omits other task statuses
  regardless of terminal activity. Apply this filter only to the rail
  presentation; shared terminal inventory remains available to selected-house
  matching. The compact launcher shows the first 10 characters of the task
  title; hover or keyboard focus reveals the full title and aggregate terminal
  state, and the accessible name includes the full title and state. When a
  launcher is focused, ArrowDown/`j` and ArrowUp/`k` move through visible tasks
  in display order and wrap at either end. Enter opens that task's terminal
  modal with Agent selected without changing the active view or starting a
  process by itself. Handle these keys only within the focused rail so text
  entry and terminal input keep their existing behavior. Aggregate the Agent
  and `term` tabs in this order: Running when either tab runs; Pending when a tab
  is starting and neither runs; Unavailable when startup failed and neither tab
  is running or starting; Completed when a started session exited and neither
  tab is running, starting, or failed; otherwise Idle. Existing terminal
  inventory supplies Running, Unavailable, or Completed when no live tab state
  takes precedence. With no live process, a valid saved conversation changes the
  launcher state to Resumable and identifies its CLI as "Resume <CLI>"; it never
  represents a restored PTY or terminal buffer. A valid saved conversation for
  an In progress task keeps it discoverable after restart. Use the existing
  status treatment and tokens: teal for running/resumable, amber for pending,
  red for unavailable, blue for completed, and grey for idle.
- **Agent detail panel** (right: x 1060, y 124, w 340, padding 24, radius 24,
  glass + radial glow top-right in the provider colour; amber or red glow plus
  a 1px tinted stroke while the session awaits approval or its last turn
  failed): crumb (swatch + "Claude Code · House 03"), title 20/500
  (repo/session), back + close buttons; status pill + "model · PID"; progress
  ring 112px (track `#FFFFFF10`, arc in provider colour with glow, center
  "68%" 28/500 + "execution" 11 caption; "—" + "no plan" when only context
  fill is known) beside the step text under "CURRENT STEP" ("Waiting for
  you" / "Last turn failed" with the status icon, in the status colour, while
  awaiting approval / after an error); two stat tiles (Tokens: value 24/500 +
  "182K output"; Elapsed: `mm:ss`/`h:mm:ss` + "since 10:21"); context window
  bar (6px, readout "131K / 200K · 66%"); meta rows (Directory, Terminal/PID,
  Subagents "4 · 2 running · 1 needs you"); actions: primary teal button
  "Open folder", a conditional Terminal button, and a ghost icon button. Show
  Terminal only when the selected session's normalized absolute cwd matches a
  task worktree and that task has an Argis-managed terminal target in shared
  terminal inventory, regardless of whether the task is visible in the
  In-progress-only rail. It opens the same terminal modal over the Dashboard
  without switching views.
- **Subagents strip** (bottom: x 40, y 770, full width − 80, only when the
  selected session has subagents): header column (git-fork icon "Subagents",
  "Spawned by <title> / N total · M running") then equal-width cards (radius
  16, padding 16): title 14/500 + status pill (icon + label tinted by status),
  4px progress bar in status colour, meta row: `%`, tokens, elapsed with tiny
  icons. Awaiting-approval cards get an amber-tinted fill and stroke.

## Task workspace extension
- The city remains the startup and primary monitoring view. A top-bar Tasks
  icon opens an optional full-window task workspace; Back to city returns to
  monitoring without changing snapshot polling.
- The workspace header contains "Projects & tasks" and a plain Back to city
  action. The board has an All projects filter, a Search tasks field, Manage
  projects action, New task action, and three columns: Pending, In progress,
  and Other statuses. Stopped, Canceled, and Completed remain individually
  labeled in the final column. Search is case-insensitive and matches each
  whitespace-separated query token against a task's ID (with or without `#`),
  title, description, project name (the final path segment), or project path;
  different tokens may match different fields. The project filter intersects
  the search results. An empty query shows every task eligible for the selected
  project (or every task under All projects); results retain board order and
  the three status groups remain in Pending, In progress, Other statuses order.
- With the search field focused, ArrowDown focuses the first matching task and
  ArrowUp focuses the last. From a focused task card, ArrowDown/ArrowUp or
  `j`/`k` move to the next or previous visible task in the same status column.
  They stop at the first and last task in that column without wrapping or
  crossing into another pane. If search or project filtering removes the
  focused task, clear that focus.
- From a focused task card, ArrowLeft/ArrowRight or `h`/`l` move to the nearest
  populated status column, preserving the row when possible and clamping to the
  last task in a shorter column; horizontal navigation stops at the outer
  columns. Vim navigation keys do not take input from text fields and are
  exposed through the task card's keyboard-shortcut semantics.
- In the task board, `gg` (two consecutive unmodified `g` presses within 500 ms)
  focuses the first visible task, and `Shift+G` focuses the last visible task in
  the current filtered board order. A pending `g` is cleared by unrelated or
  ineligible key events.
- Unmodified `c` opens the existing New task flow. Unmodified `b` and `t` on a
  focused, visible task invoke its existing branch/worktree and terminal
  actions, respectively. Keep their existing eligibility: `c` requires at
  least one registered project, `b` requires Git to allow branch creation and
  no existing task branch, and `t` requires the task's existing worktree. `b`
  explicitly invokes the branch/worktree action; `t` opens the task's shared
  Agent resume flow without changing the app
  view and does not create a branch or worktree as a side effect. Search does
  not create Git resources.
- Unmodified `s` on a focused, visible task opens a status picker. The picker
  lists all statuses in the fixed task-status order, with `1` through `5`
  selecting Pending, In progress, Stopped, Canceled, and Completed. Selecting a
  status closes the picker and returns focus to the same task, including when it
  moves to another column; canceling also restores focus to that task.
- Suppress the single-letter actions and Vim task navigation while a dialog is
  open or focus is in an input, textarea, select, contenteditable element, or
  xterm input; also ignore modified, repeated, or composing key events, except
  for the intentional `Shift+G` motion. Search arrows are the explicit
  editable-field exception: ArrowDown/ArrowUp navigate matching results there,
  while other typed characters (including `c`, `b`, `s`, and `t`) remain search
  text.
- Each task entry shows its generated ID, title, description, project name, and
  exact status. Its action row has four icon buttons in this order: Create
  branch/worktree, Open terminal, previous status, next status. Disable status
  movement at the ends of the fixed status order and explain unavailable Git
  or terminal actions without removing their place in the row.
- The status picker is a compact native modal using the approved panel, border,
  and radius tokens. Show five full-width status rows with `1`–`5` keycaps and
  mark the task's current status; number keys and row buttons select a status,
  and Escape cancels.
- Manage projects uses a modal listing registered local paths and an add-path
  form with an explicit "Create the directory if it doesn’t exist" checkbox.
  New task and edit task use a modal form for task name and description; task
  creation additionally requires a project. Editing a task exposes Delete
  task inside the editor; confirmation asks whether to also remove its branch
  and worktree and warns that active Agent/shell sessions will be stopped. If
  a session cannot be stopped and reaped, deletion is aborted and the task and
  worktree remain. A failed safe Git cleanup leaves a notice with the remaining
  paths, while the task is still removed. Keep the approved palette, type,
  radii, and spacing tokens unchanged.
- Opening a task terminal shows a full-height terminal modal over the current
  view, horizontally centered within the existing width constraints. Its header
  identifies the task and worktree, with Agent and `term` tabs above
  full-size xterm viewports. Before process startup, each viewport stays blank
  and its tab reads `Not started`. A live Agent PTY reattaches directly. With no
  live Agent PTY, the Agent pane offers `Resume <CLI>` when a saved reference is
  valid, plus a CLI selector and `Start new` action; missing or stale references
  show "Resume unavailable" while keeping `Start new` available. The `term`
  pane has an explicit Start shell action. Tab labels reflect startup, running,
  exited, and unavailable
  states, with launch errors shown inside only the affected pane. Closing returns
  to the current view while leaving processes and mounted xterm buffers
  available. The terminal host lives outside the conditional Dashboard/Tasks
  view tree, so switching views does not detach its tabs. A task result selected
  in `⌘K` opens the same modal over the current view without navigating to Tasks;
  running Agent and shell sessions reattach, and absent sessions show the
  existing resume-or-new controls. Dashboard launchers, the task-board `t`
  shortcut, and a matching selected-house Terminal action all open this same
  task-scoped modal without switching views. Tasks without worktrees remain
  searchable and show
  "No worktree · Go to Tasks"; search never creates Git resources. When a
  terminal target is later reopened after detachment, retained recent PTY output
  is restored before live output. Terminal text uses a system monospace font
  with zero letter spacing; Outfit remains the surrounding UI font.
- Terminal keyboard behavior: The modal opens on Agent and focuses the active
  xterm input after its pane is visible, fitted, and any session reattachment
  completes, including when the terminal has not started. While the modal is
  open, Ctrl+Tab toggles Agent ↔ `term`, prevents host/browser tab switching,
  then fits and focuses the active terminal input. Keep the accessible tab-button
  ArrowLeft/ArrowRight/Home/End navigation. Unmodified `s` starts the selected
  Agent or shell pane when it is startable, including while xterm has focus;
  when running, `s` remains terminal input. Ignore modified, repeated, composing,
  and form-control keystrokes. Escape is passed to xterm and does not close the
  modal while terminal input has focus. `Ctrl+Shift+W` closes the modal from any
  focus target; Escape still closes it when focus is outside terminal input.
  Closing returns focus to the opener and leaves both PTYs alive for reattachment.

### Task-board presentation
- The three task groups use open, evenly distributed lanes with consistent
  gutters and whitespace; do not enclose a lane in a panel. Task cards remain
  the primary boundaries. At narrow widths, stack the lanes without horizontal
  overflow.
- Keep each task's exact status label visible. Pending uses the neutral
  `--text-2` color; In progress uses `--teal`, Stopped `--amber`, Canceled
  `--red`, and Completed `--blue`. Status labels use a 12% semantic-color fill
  and a 42% semantic-color border; do not tint the full card.
- Normal-size task-board text, including task metadata, lane headings, and
  status labels, maintains at least 4.5:1 contrast against its rendered
  background.
- A successful status change briefly fades the status label from a stronger
  semantic tint (28% fill / 72% border) to its resting treatment over 480 ms.
  The feedback does not change card dimensions or position and is disabled when
  `prefers-reduced-motion: reduce` is active.
- Keep a compact shortcut legend visible directly below the board toolbar at
  all times. Reuse the existing keycap treatment; let the legend wrap at narrow
  widths without horizontal overflow. Show ArrowUp/ArrowDown or `j`/`k` for
  within-lane movement; ArrowLeft/ArrowRight or `h`/`l` for movement between
  lanes; `gg` for the first visible task and `Shift+G` for the last; and `c`,
  `b`, `t`, and `s` for task actions.
- Shortcut behavior and availability: with Search tasks focused,
  ArrowDown/ArrowUp focus the first/last matching task. From a focused card,
  ArrowDown/ArrowUp or `j`/`k` move within its lane without crossing lanes;
  ArrowLeft/ArrowRight or `h`/`l` move to the nearest populated lane. `gg` is
  two unmodified `g` presses within 500 ms; `Shift+G` focuses the last visible
  task. Unmodified `c` opens New task only when a project is registered; `b`
  creates a branch/worktree only for a focused visible task eligible for branch
  creation with no existing branch; `t` opens the focused visible task's shared
  Agent-resume terminal flow only when its worktree exists; `s` opens the status
  picker for a focused visible task, where `1`–`5` select the status in the
  fixed order. Selecting a status keeps focus on that task after a column move.
  Keep the existing input (including xterm), dialog, modifier, repeat, and
  composition guards.

## Progress readouts
Progress is a real estimate only when it comes from a plan (`execution`) or
the status (`complete`). The context-window fallback is never shown as a bare
percentage: rows, the selected-house callout and subagent cards read
`ctx 74%`, rings and bars stay empty, and the panel's context bar owns the
number.

## Status visuals
| status           | pill label       | colour  | icon     |
| ---------------- | ---------------- | ------- | -------- |
| running          | Running          | teal    | loader   |
| awaitingApproval | Needs approval   | amber   | hand     |
| idle             | Idle             | grey    | moon     |
| done             | Done             | blue    | check    |
| error            | Error            | #FF6B6B | alert    |

Lists (agents, ⌘K palette) sort Needs you → Error → Running → Idle → Done,
oldest first within a status.

## 3D scene
- One tower per provider on a 2×2 diamond (Claude back, Codex left,
  OpenCode front, Pi right). Low-poly dark matte (`#1A1D1F`–`#24282B`)
  boxes with emissive window strips and rooftop panels in the provider
  colour; height grows mildly with live session count.
- Houses ring the tower (radius grows; second ring after 8): box + 4-sided
  pyramid roof, emissive windows/roof panels coloured by **status**
  (running pulses softly; awaiting blinks amber; idle dim; done blue).
  Thin glowing lines connect each house lot to its tower.
- Bloom post-processing for the neon glow. Hover = pointer + lift/brighten;
  click = select (opens panel, shows marker). Click empty ground = deselect.
- Empty state: tower stays with dim windows and a "No live sessions" label.
