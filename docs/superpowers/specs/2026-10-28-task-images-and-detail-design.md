# Task images and the task detail sheet

Date: 2026-10-28
Status: draft for approval
Affects: task store (SQLite v3), Rust commands, `AgentSource`, task board, task editor, new task sheet

## Intent

A task is Argis's unit of work, but today it is only two text fields. Real tasks
often start from a picture: a failing screenshot, a design mock, an error dialog,
a diagram. That picture currently lives in Downloads or on the clipboard and is
lost the moment the task is written down.

This change makes an image a first-class, optional part of a task:

- it can be dropped, pasted, or picked while creating or editing a task;
- it is copied into Argis's own storage, so moving or deleting the original file
  does not break the task;
- it can be viewed and copied back to the clipboard later, so it can be pasted
  into the agent terminal with Ctrl+V;
- the whole task (title, description, images) gets a read-only view opened with
  Enter, with copy actions for each part.

## Goals

1. Attach images to a task through three equivalent inputs: drag and drop, paste
   from the clipboard, and a file picker.
2. Keep the image bytes inside Argis storage; the source path is never required
   again.
3. Open a read-only task sheet with Enter from a focused task card.
4. Offer copy actions for the title, the description, and every attached image
   (as pixel data suitable for pasting into a terminal agent).
5. Leave the `Provider` read-only rule untouched: Argis writes only its own
   SQLite database and its own app-data directory.

## Non-goals

- No automatic handoff into the agent: Argis does not mirror images into the
  worktree and does not pre-fill the first prompt. Copy -> Ctrl+V is the whole
  handoff, as decided by the user.
- No image editing, cropping, annotation, or OCR.
- No thumbnails of the bytes on the board (a count badge instead).
- No image aware search: the board search keeps matching ID, title,
  description, project name, and project path.
- No export, sync, or cloud upload.
- No paste target outside the task editor dialog and the task sheet (for
  example, dropping an image on the city does nothing).
- No reading the clipboard from Rust; paste is the webview `paste` event.
- No reordering of attached images; they stay in attachment order.

## Anti-goals

- The task row must not carry binary data. No base64 blobs in `tasks` and no
  blobs in SQLite.
- The task sheet must not become a second editor. Editing stays in the existing
  editor dialog, reached from the sheet by one button.
- A failed save must never lose existing images or leave a half-written task.
- The image path must never be composed from user input at read time.

## Decisions

### From the user

- An image is both a record for the task and material for the agent; the handoff
  is manual (`copy -> Ctrl+V` in the agent tab).
- "Copy image" means the picture itself lands on the clipboard, not a path.
- The terminal shortcut that pastes it is Ctrl+V (the paste gesture in the
  agent CLIs), so the copy must write real image data, not text.

### Builder's calls (kept here so they can be challenged without guessing)

- **Bytes on disk, metadata in SQLite.** Files live under
  `<app_data_dir>/task-images/<task_id>/<image_id>`, with no extension: the MIME
  type in the row is the only source of truth.
- **One atomic save.** `create_task` and `update_task_details` receive the full
  desired image list and apply text, additions and removals in a single SQLite
  transaction. There is no separate import/delete command and no partially saved
  task, so Cancel always means "nothing changed".
- **Read through a command, not the asset protocol.** `read_task_image` returns
  raw bytes and the UI renders a blob URL. This avoids enabling Tauri's asset
  protocol, widening its scope, and touching `tauri.conf.json`.
- **Base64 over IPC for image payloads.** Saves are user-initiated and
  infrequent; base64 keeps the command signature ordinary and testable. Caps
  keep a pathological payload out of the bridge.
- **Keep the original bytes; normalize only when copying.** PNG, JPEG, WebP and
  GIF stay as they are on disk. Copying converts to PNG in the webview canvas
  because that is the format every paste target accepts.
- **The sheet is read-only**, reached by Enter, with explicit Edit and Close
  actions.
- **Caps**: 12 images per task, 10 MiB per image, 30 MiB total per task. All are
  enforced in Rust; the UI mirrors the numbers in its copy.
- **Duplicates are allowed**; the same picture can be attached twice. Detecting
  duplicates would need hashing and buys nothing.

## Data model

### Wire types (TS and Rust)

`Task` gains one field, and two new types describe image input:

```ts
export type TaskImageMimeType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export interface TaskImage {
  id: number;
  fileName: string;
  mimeType: TaskImageMimeType;
  /** Bytes stored on disk (the original encoding, not a copy-time conversion). */
  byteSize: number;
}

/** One entry of the desired image set sent with a task save. */
export interface TaskImageInput {
  /** Existing image kept on the task; `null` for a newly added image. */
  imageId: number | null;
  fileName: string;
  mimeType: TaskImageMimeType;
  /** Present only when `imageId` is `null`. */
  dataBase64: string | null;
}

/** A file read from disk for the drag-and-drop path. */
export interface TaskImageFile {
  fileName: string;
  mimeType: TaskImageMimeType;
  byteSize: number;
  dataBase64: string;
}

export interface Task {
  id: number;
  projectId: number;
  title: string;
  description: string;
  status: TaskStatus;
  branchName: string | null;
  worktreePath: string | null;
  /** Ordered by id ascending. Never carries bytes. */
  images: TaskImage[];
}
```

Rust mirrors these with `#[serde(rename_all = "camelCase")]`; the MIME type is
an enum serialized as the MIME string. `images` is always present (`[]`, never
`null`), so the UI never branches on absence. It is a new field on an existing
type, not an optional one.

Rules on `TaskImageInput`:

- `imageId: null` requires `dataBase64` and imports a new file;
- `imageId: n` requires `dataBase64: null`, must belong to the task being saved,
  and keeps the row untouched (the `fileName`/`mimeType` must match the stored
  row or the save is rejected);
- `create_task` rejects any non-null `imageId`;
- an existing image omitted from the list is deleted in the same transaction.

### SQLite (schema version 3)

Migration from version 2 adds:

```sql
CREATE TABLE task_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 160),
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
    byte_size INTEGER NOT NULL CHECK (byte_size > 0)
);
CREATE INDEX task_images_by_task ON task_images(task_id, id);
```

`user_version` becomes 3. Version 1 and 2 databases migrate forward in the same
transaction; a newer version is still rejected.

Files:

- root: `<app_data_dir>/task-images`, derived from the database path's parent
  (`…/argis.sqlite` -> `…/task-images`) and never from a task field;
- task directory: `<root>/<task_id>`;
- file: `<root>/<task_id>/<image_id>`, written through a temp sibling
  (`.tmp-<image_id>`) and renamed into place;
- deleting a task removes its directory (best effort, logged on failure, never
  fails the delete);
- if a save transaction fails after files were written, every file written by
  that save is unlinked before the error is returned;
- a crash between the row insert and the rename can leave an unreferenced temp
  file; a startup sweep is out of scope, and temp files are named so a future
  sweep can find them.

`TaskStore` keeps its `Mutex<Connection>` and gains `image_root: PathBuf`. All
image writes happen under the existing lock, so no reader ever sees metadata
without its file.

## Transport

Changed commands, added to `generate_handler![…]`, `AgentSource`,
`tauriAgentSource.ts`, `mockAgentSource.ts`, and the Transport table in
`docs/CONTRACT.md`:

| command | payload -> return |
| --- | --- |
| `create_task` | `{ projectId, title, description, images: TaskImageInput[] }` -> `Task` |
| `update_task_details` | `{ id, title, description, images: TaskImageInput[] }` -> `Task` |
| `read_task_image` | `{ imageId }` -> raw `ArrayBuffer` |
| `read_image_file` | `{ path }` -> `TaskImageFile` |

> `create_task` loses its old three-argument shape, so `agentSource.ts`,
> `tauriAgentSource.ts`, `mockAgentSource.ts`, the editor, the store, and every
> caller in the tests move together.

Rules:

- The save commands return the full updated `Task`, images included.
- `read_task_image` answers with `tauri::ipc::Response::new(bytes)` so the IPC
  payload is binary. It errors when the row or file is missing.
- `read_image_file` exists for the Tauri drag-and-drop path, which supplies
  paths and not `File` objects. It validates an absolute path to a regular
  file, enforces the per-image cap, sniffs the MIME type from magic bytes, and
  returns the bytes base64-encoded. It never writes anything.
- MIME types are always sniffed in Rust from magic bytes; the client-supplied
  `mimeType` is validated against the sniffed value and rejected on mismatch.
  A file the webview cannot decode is rejected rather than stored.
- `file_name` is stored for display only: path separators and control
  characters are stripped and the result is capped at 160 characters.
- Errors are `String` at the command boundary, as everywhere else.

Capability change: `clipboard-manager:allow-write-image` in
`src-tauri/capabilities/default.json`, needed by the per-image copy action.

Build change: `tauri = { version = "2", features = ["image-png"] }` in
`src-tauri/Cargo.toml`. Without it, `writeImage` rejects PNG bytes at runtime
(`JsImage::Bytes` only decodes when `image-png` or `image-ico` is enabled). The
`image` crate is already in `Cargo.lock` transitively, so no new crate enters
the lock file.

Dependency change: `base64 = "0.22"` becomes a direct dependency of the Rust
crate for decoding import payloads. It is already in `Cargo.lock` transitively
at 0.22.1.

## Flows

### Saving in the editor

The editor owns three staged collections:

- `added: { fileName: string; mimeType: TaskImageMimeType; byteSize: number; dataBase64: string; previewUrl: string }[]`
  for images dropped, pasted, or picked;
- `keptIds: number[]` (or simply "existing images minus removed") for attached
  images the user did not detach;
- `removedIds: number[]` for attached images the user detached.

Save builds `TaskImageInput[]` in display order: existing images that remain
(with `imageId`), followed by newly added ones (with `imageId: null` and their
base64). It sends one create/update call. Success closes the dialog and the
store replaces the task. Failure keeps the dialog open with `store.error` and
nothing changed, because the backend transaction rolled back.

Cancel clears staged state, revokes preview URLs, and writes nothing.

### Getting the bytes in

| Input | Tauri | Browser mock |
| --- | --- | --- |
| Drop | `onDragDropEvent` from `@tauri-apps/api/webview`, listened only while the editor is open; each path goes through `read_image_file` | HTML5 `dragover`/`drop` on the dialog, reading `DataTransfer.files` |
| Paste | `paste` listener on the dialog, reading `event.clipboardData.files` | same |
| Click | hidden `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple>` inside the drop zone | same |

Because Tauri's native drag-drop accepts the drag before the DOM sees it, a drop
is accepted **anywhere in the window while the editor is open**. The editor
shows a dialog-wide affordance while a drag is in flight ("Drop to attach to
this task") so the behaviour is visible rather than surprising.

For `File` objects the browser path reads bytes with `File.arrayBuffer()` and
base64-encodes them; MIME sniffing has a TS mirror in `src/domain/imageFiles.ts`
so the browser mock rejects the same files the backend would.

In the browser mock, images are held in memory in `mockAgentSource` and returned
from `read_task_image` as their original bytes, so `pnpm dev` exercises the
whole flow.

Validation in the UI is a mirror, not the authority: it rejects unsupported
types, files over 10 MiB, a new image that would push the task past 12 images,
and a set whose total exceeds 30 MiB, with a readable error before calling the
backend.

### Viewing and copying

Enter on a focused task card opens `TaskSheet.vue`:

- header: `#<id>`, project name, status pill, Close;
- title (`<h2>`) with a "Copy title" button;
- description with preserved line breaks (`white-space: pre-wrap`) and a
  "Copy description" button; an empty description shows "No description";
- images as a vertical list of contained previews (max-height 320px) with the
  file name, size, and a "Copy image" button per image;
- footer: "Edit task", which closes the sheet and opens the existing editor
  with that task.

Copy behaviour:

- text: `writeClipboardText` from `src/services/clipboard.ts` (native pasteboard
  in Tauri, web API in the browser);
- image: read the bytes, `createImageBitmap`, draw to a canvas at native size,
  `canvas.toBlob("image/png")`, then `writeImage(new Uint8Array(bytes))` in
  Tauri (`tauri::image::Image::from_bytes` decodes it via the new `image-png`
  feature) or `navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])`
  in the browser. A conversion or write failure shows an inline error next to
  that image; the sheet stays open;
- each button swaps its icon to a check for 1.5 s, matching `PanelActions.vue`.

The preview fetch is one command per mounted image. A `useTaskImageObjectUrl`
composable creates the blob URL on mount and revokes it on unmount, so the sheet
and the editor thumbnails each own their URLs and no cache needs eviction.

### Keyboard and board

- `TaskCard` handles `Enter` only when the event target is the card itself
  (`article[tabindex=0]`), so Enter on a child action button still activates
  that button. It emits `view`, and the board opens the sheet for that task.
- The card declares `Enter` in `aria-keyshortcuts`; the board legend gains
  "Enter · open task".
- While the sheet is open, the existing dialog guard
  (`isViewShortcutBlocked`) already suppresses `c`, `b`, `t`, `s`, `g`, `G`.
- Escape closes the sheet through the native `<dialog>` behaviour.
- After closing, focus returns to the card that opened it, like the other
  dialogs in the workspace.

### Board and badge

`TaskCard` shows a small image badge (`ImageIcon` + count) in the meta row when
`task.images.length > 0`, with an accessible label ("3 images attached"). The
card does not load image bytes.

## Copy and layout (design tokens only)

- Drop zone: dashed `--border-strong` rectangle, `--radius-card`, 96px minimum
  height, label in `--text-2` 13px, helper line in `--text-3` 11px.
- Thumbnails: 88x88 tiles, `object-fit: cover`, `--radius-card`, 1px `--border`,
  remove button top-right (24px, `--fill-subtle`).
- Sheet: native modal, `min(680px, calc(100vw - 48px))`, `--bg`, 24px padding,
  same backdrop treatment as the other task dialogs.
- Copy buttons: 34px ghost icon buttons like `.task-action`, 2px teal focus ring.
- No new colour tokens, fonts, or spacing scales.

## Tests

Rust (`task_store_tests.rs`, plus `task_images_tests.rs` with a temp dir):

- v2 -> v3 migration preserves tasks and adds the table; v0 -> v3 creates both;
- a save imports new images and returns the task with them in id order;
- a save that omits an existing image deletes its row and its file;
- a save keeps untouched images byte-for-byte and does not rewrite their files;
- save rejects: unknown MIME, MIME mismatch, empty file, per-image over 10 MiB,
  total over 30 MiB, a 13th image, an `imageId` from another task, an `imageId`
  with data, a null `imageId` without data, and a non-null `imageId` on create;
- a failed save rolls back text and image changes and leaves no new files;
- file name sanitisation (path separators, control characters, 160-char cap);
- deleting a task removes its directory and cascades the rows;
- `list_tasks` returns images for every task without N+1 queries;
- `read_image_file` rejects a relative path, a directory, a non-image, and an
  oversized file, and returns the sniffed type for each supported format;
- `read_task_image` errors on a missing row and a missing file.

Frontend (`src/domain/` and `src/stores/`, Vitest node environment):

- `imageFiles.ts`: MIME sniffing, size/type/count validation messages, and the
  "existing minus removed plus added" list builder;
- `taskBoardShortcuts.ts`: Enter resolves only for an unmodified key on the card
  itself, and never while a dialog is open or focus is in an editable field;
- `stores/tasks.test.ts`: create/update carry the image list, replace the task in
  place, and clear errors; a failed save leaves the previous images intact;
- `tauriAgentSource.test.ts` and `mockAgentSource.test.ts`: the new payloads and
  the two read methods round-trip.

## Docs to update with the code

- `docs/CONTRACT.md`: Transport rows and payloads, the `TaskImage` paragraph,
  storage location, caps, the sniffed-MIME rule, and the atomic-save rule.
- `docs/design/SPEC.md`: Task workspace extension gains the attachment area,
  Enter -> task sheet, the sheet's read-only layout, the copy actions, and the
  card badge.
- `AGENTS.md` does not change.

## Rollout notes

- Existing databases migrate in place; existing tasks get `images: []`.
- No provider data is read or written by this feature.
- The capability addition and the `image-png` feature are the only build/config
  changes.
