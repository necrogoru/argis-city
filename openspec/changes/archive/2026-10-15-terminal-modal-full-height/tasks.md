# Tasks

## 1. Full-height modal sizing

- [x] 1.1 Update the terminal modal's desktop and narrow-window CSS sizing and vertical positioning to fill the app window while preserving the current width rules; verify it reaches the window's top and bottom and the terminal viewport expands.
- [x] 1.2 Update the terminal modal entry in `docs/design/SPEC.md` to specify full app-window height; verify it agrees with the new layout requirement and keeps the existing modal controls and width behavior unchanged.

## 2. Layout verification

- [x] 2.1 Open the terminal modal at the 1440×900 reference size and at a short, narrow app-window size; verify it fills the available height, the header/tabs/footer remain visible, and the terminal viewport uses the remaining space without overflow.
