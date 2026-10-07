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
  "Search agents & actions" text-3, `⌘K` key cap; Ctrl K off macOS),
  "Live · scanning 2s" teal-tinted pill with glowing dot, settings button.
- **Command palette** (click the search field or ⌘K/Ctrl K; ⌘K again or
  Esc closes without clearing the selection): 640px glass modal, 112px from
  the top over a dimmed, blurred backdrop. 60px search row, then an
  "AGENTS" section (status dot, highlighted title, `provider · model ·
  ~/dir`, status pill; the 6 most urgent until the user types) and an
  "ACTIONS" section (selected-agent shortcuts: open folder, copy path,
  close details; go to each district; show whole city; camera moves;
  refresh). ↑↓ moves (wraps), ↵ runs, hover moves the cursor; matches are
  teal. Footer with key hints.
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
  "Open folder" + ghost icon button.
- **Subagents strip** (bottom: x 40, y 770, full width − 80, only when the
  selected session has subagents): header column (git-fork icon "Subagents",
  "Spawned by <title> / N total · M running") then equal-width cards (radius
  16, padding 16): title 14/500 + status pill (icon + label tinted by status),
  4px progress bar in status colour, meta row: `%`, tokens, elapsed with tiny
  icons. Awaiting-approval cards get an amber-tinted fill and stroke.

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
