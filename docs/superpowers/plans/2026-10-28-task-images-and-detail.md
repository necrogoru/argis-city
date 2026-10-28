# Task Images and Task Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a task carry optional images (dropped, pasted, or picked), add a read-only task sheet opened with Enter, and let every part of a task be copied — including each image as real clipboard pixels.

**Architecture:** Image bytes live under the app-data dir (`task-images/<taskId>/<imageId>`), metadata lives in a new `task_images` SQLite table, and `Task` carries only image metadata. Creating or updating a task sends the full desired image set in one call; the Rust store applies text, additions, and removals in one transaction. The UI reads image bytes through a command and renders blob URLs, and copies images by converting them to PNG in a canvas before writing to the pasteboard.

**Tech Stack:** Rust 1.99 + Tauri 2 (`rusqlite`, `base64`), Vue 3.5 + Pinia DOM components, Vitest (node environment), native `<dialog>` elements.

**Spec:** `docs/superpowers/specs/2026-10-28-task-images-and-detail-design.md`

## Global Constraints

- Caps, enforced in Rust and mirrored in TS: **12 images per task**, **10 MiB per image** (`10 * 1024 * 1024`), **30 MiB total per task** (`30 * 1024 * 1024`).
- Accepted MIME types: `image/png`, `image/jpeg`, `image/webp`, `image/gif`. Rust sniffs them from magic bytes; the client value is only validated against the sniff.
- Image bytes never go into SQLite. Files are `<image_root>/<taskId>/<imageId>` with `image_root = <database parent>/task-images`, written temp-then-rename.
- One atomic save: a failed save changes no text, no rows, and leaves no new files. Cancel writes nothing.
- No asset protocol and no `tauri.conf.json` change. New capability: only `clipboard-manager:allow-write-image`.
- Providers stay read-only; this feature writes only Argis's own SQLite and app-data dir.
- Wire types change together: `src/domain/types.ts` ⇄ `src-tauri/src/domain/` ⇄ `docs/CONTRACT.md`.
- Wire naming: camelCase (`imageId`, `dataBase64`); `Option` serializes as `null`, never omitted. Timestamps are Unix epoch milliseconds (none are added here).
- Gate before "done": `pnpm build`, `pnpm exec vitest run`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo fmt --manifest-path src-tauri/Cargo.toml --check`.
- Commits: Conventional Commits, as in this repo's history (`feat(tasks): …`, `feat(rust): …`, `docs: …`).

## Review Focus

- A 10.1 MiB image is rejected with a readable message, the dialog stays usable, and nothing is written (Task 3, Task 7).
- Pasting text, a PDF, or an unsupported image adds nothing and shows one clear message (Task 7).
- Removing one image while adding one at the 12-image cap saves successfully, because the cap applies to the final set (Task 3, Task 7).
- Copying a JPEG puts a picture on the pasteboard (converted to PNG), so Ctrl+V in the agent pastes an image rather than a path (Task 6).
- Dropping a folder, a 0-byte file, or a missing path is rejected without crashing or closing the dialog (Task 2, Task 7).
- A save interrupted after files were written leaves no metadata without a file, and no duplicate task on retry (Task 3).

---

### Task 1: Rust wire types and schema version 3

**Files:**
- Modify: `src-tauri/src/domain/task.rs`
- Modify: `src-tauri/src/domain/mod.rs:20`
- Modify: `src-tauri/src/task_store.rs:10`, `:82-95`, `:194-234`, `:236-260`
- Test: `src-tauri/src/task_store_tests.rs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `TaskImageMimeType` (`Png`, `Jpeg`, `Webp`, `Gif`) with `fn as_str(self) -> &'static str` and `fn from_db_value(value: &str) -> Option<Self>`
  - `TaskImage { id: i64, file_name: String, mime_type: TaskImageMimeType, byte_size: i64 }`
  - `TaskImageInput { image_id: Option<i64>, file_name: String, mime_type: TaskImageMimeType, data_base64: Option<String> }`
  - `TaskImageFile { file_name: String, mime_type: TaskImageMimeType, byte_size: i64, data_base64: String }`
  - `Task.images: Vec<TaskImage>`
  - `TaskStore::open(&Path)` keeps its signature and gains a private `image_root = path.parent().join("task-images")`.

- [ ] **Step 1: Write the failing tests**

In `src-tauri/src/task_store_tests.rs`, change `task_store_records_schema_version` to expect `3`, then add:

```rust
#[test]
fn task_store_migrates_v2_and_keeps_existing_tasks() {
    let dir = tempfile::tempdir().unwrap();
    let database_path = dir.path().join("argis.sqlite");
    let legacy = Connection::open(&database_path).unwrap();
    legacy
        .execute_batch(
            "PRAGMA foreign_keys = ON;
             CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL UNIQUE);
             CREATE TABLE tasks (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                 title TEXT NOT NULL,
                 description TEXT NOT NULL,
                 status TEXT NOT NULL CHECK (status IN ('pending', 'inProgress', 'stopped', 'canceled', 'completed')),
                 branch_name TEXT,
                 worktree_path TEXT
             );
             CREATE INDEX tasks_by_project ON tasks(project_id, id);
             CREATE TABLE task_agent_resume (
                 task_id INTEGER PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
                 provider TEXT NOT NULL,
                 native_reference TEXT NOT NULL,
                 worktree_path TEXT NOT NULL,
                 last_observed_at_ms INTEGER NOT NULL
             );
             INSERT INTO projects (id, path) VALUES (1, '/projects/argis');
             INSERT INTO tasks (id, project_id, title, description, status, branch_name, worktree_path)
             VALUES (7, 1, 'Legacy task', 'text', 'pending', NULL, NULL);
             PRAGMA user_version = 2;",
        )
        .unwrap();
    drop(legacy);

    let store = TaskStore::open(&database_path).unwrap();
    let task = store.get_task(7).unwrap();
    assert_eq!(task.title, "Legacy task");
    assert!(task.images.is_empty());

    let connection = Connection::open(&database_path).unwrap();
    let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0)).unwrap();
    assert_eq!(version, 3);
    let tables: i64 = connection
        .query_row("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'task_images'", [], |row| row.get(0))
        .unwrap();
    assert_eq!(tables, 1);
}

#[test]
fn task_store_reads_images_with_tasks_in_id_order() {
    let dir = tempfile::tempdir().unwrap();
    let database_path = dir.path().join("argis.sqlite");
    let store = TaskStore::open(&database_path).unwrap();
    let project = store.create_project("/projects/argis").unwrap();
    let task = store.create_task(project.id, "With images", "").unwrap();

    let connection = Connection::open(&database_path).unwrap();
    for (file_name, mime_type) in [("first.png", "image/png"), ("second.jpg", "image/jpeg")] {
        connection
            .execute(
                "INSERT INTO task_images (task_id, file_name, mime_type, byte_size) VALUES (?1, ?2, ?3, 4)",
                rusqlite::params![task.id, file_name, mime_type],
            )
            .unwrap();
    }
    drop(connection);

    let listed = store.list_tasks(None).unwrap();
    let names: Vec<&str> = listed[0].images.iter().map(|image| image.file_name.as_str()).collect();
    assert_eq!(names, vec!["first.png", "second.jpg"]);
    assert_eq!(store.get_task(task.id).unwrap().images.len(), 2);
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml task_store_ -- --nocapture`
Expected: compile error (`Task` has no `images`, `user_version` is 2, no `task_images` table).

- [ ] **Step 3: Add the wire types**

In `src-tauri/src/domain/task.rs`, add the four types, `Task.images`, and the enum helpers:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskImageMimeType {
    #[serde(rename = "image/png")]
    Png,
    #[serde(rename = "image/jpeg")]
    Jpeg,
    #[serde(rename = "image/webp")]
    Webp,
    #[serde(rename = "image/gif")]
    Gif,
}

impl TaskImageMimeType {
    pub const fn as_str(self) -> &'static str { /* "image/png" | … */ }
    pub fn from_db_value(value: &str) -> Option<Self> { /* inverse */ }
}
```

`TaskImage`, `TaskImageInput`, and `TaskImageFile` derive `Debug, Clone, PartialEq, Eq, Serialize, Deserialize` and use `#[serde(rename_all = "camelCase")]`. Export all of them from `src-tauri/src/domain/mod.rs`.

- [ ] **Step 4: Add the schema migration and image reads**

In `task_store.rs`: `SCHEMA_VERSION = 3`; add `image_root: PathBuf` to `TaskStore`; add the `task_images` table and index for any version below 3 (keep the existing `task_agent_resume` creation for versions below 2); add `images_by_task(connection, project_id) -> HashMap<i64, Vec<TaskImage>>` using one `JOIN tasks` query ordered by `task_images.id`; attach the map in `list_tasks` and call the same helper for one task in `task_by_id`. `task_from_row` sets `images: Vec::new()`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml task_store_`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/domain/task.rs src-tauri/src/domain/mod.rs src-tauri/src/task_store.rs src-tauri/src/task_store_tests.rs
git commit -m "feat(tasks): add task image wire types and schema v3"
```

---

### Task 2: Image helpers (sniff, sanitize, decode, read a file)

**Files:**
- Create: `src-tauri/src/task_images.rs`
- Create: `src-tauri/src/task_images_tests.rs`
- Modify: `src-tauri/src/lib.rs` (module list), `src-tauri/Cargo.toml` (add `base64 = "0.22"`)
- Test: `src-tauri/src/task_images_tests.rs`

**Interfaces:**
- Consumes: `TaskImageFile`, `TaskImageInput`, `TaskImageMimeType` from Task 1.
- Produces:
  - `MAX_TASK_IMAGES: usize = 12`, `MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024`, `MAX_TASK_IMAGE_BYTES: i64 = 30 * 1024 * 1024`
  - `pub(crate) fn sniff_mime_type(bytes: &[u8]) -> Option<TaskImageMimeType>`
  - `pub(crate) fn sanitize_file_name(name: &str) -> String`
  - `pub(crate) fn decode_image_input(input: &TaskImageInput) -> anyhow::Result<Vec<u8>>`
  - `pub(crate) fn read_image_file(path: &Path) -> anyhow::Result<TaskImageFile>`
  - `pub(crate) fn stored_image_path(image_root: &Path, task_id: i64, image_id: i64) -> PathBuf`

- [ ] **Step 1: Write the failing tests**

Create `src-tauri/src/task_images_tests.rs`:

```rust
use crate::domain::{TaskImageInput, TaskImageMimeType};
use crate::task_images::{decode_image_input, read_image_file, sanitize_file_name, sniff_mime_type};

const PNG: &[u8] = &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];
const JPEG: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0];
const GIF: &[u8] = b"GIF89a\x01\x00\x01\x00";
const WEBP: &[u8] = b"RIFF\x24\x00\x00\x00WEBPVP8 ";

#[test]
fn sniffs_supported_image_formats() {
    assert_eq!(sniff_mime_type(PNG), Some(TaskImageMimeType::Png));
    assert_eq!(sniff_mime_type(JPEG), Some(TaskImageMimeType::Jpeg));
    assert_eq!(sniff_mime_type(GIF), Some(TaskImageMimeType::Gif));
    assert_eq!(sniff_mime_type(WEBP), Some(TaskImageMimeType::Webp));
    assert_eq!(sniff_mime_type(b"%PDF-1.7"), None);
    assert_eq!(sniff_mime_type(&[]), None);
}

#[test]
fn sanitizes_display_file_names() {
    assert_eq!(sanitize_file_name("../screens/a\nb.png"), "a b.png");
    assert_eq!(sanitize_file_name("   "), "image");
    assert_eq!(sanitize_file_name(&"x".repeat(400)).len(), 160);
}

#[test]
fn decodes_input_and_rejects_bad_payloads() {
    let ok = TaskImageInput {
        image_id: None,
        file_name: "shot.png".into(),
        mime_type: TaskImageMimeType::Png,
        data_base64: Some(base64::engine::general_purpose::STANDARD.encode(PNG)),
    };
    assert_eq!(decode_image_input(&ok).unwrap(), PNG);

    let mut mismatch = ok.clone();
    mismatch.mime_type = TaskImageMimeType::Jpeg;
    assert!(decode_image_input(&mismatch).unwrap_err().to_string().contains("does not match"));

    let mut empty = ok.clone();
    empty.data_base64 = Some(String::new());
    assert!(decode_image_input(&empty).is_err());

    let mut missing = ok.clone();
    missing.data_base64 = None;
    assert!(decode_image_input(&missing).is_err());
}

#[test]
fn reads_image_files_and_rejects_directories_and_non_images() {
    let dir = tempfile::tempdir().unwrap();
    let image = dir.path().join("shot.png");
    std::fs::write(&image, PNG).unwrap();

    let file = read_image_file(&image).unwrap();
    assert_eq!(file.mime_type, TaskImageMimeType::Png);
    assert_eq!(file.file_name, "shot.png");
    assert_eq!(file.byte_size, PNG.len() as i64);
    assert_eq!(base64::engine::general_purpose::STANDARD.decode(file.data_base64).unwrap(), PNG);

    assert!(read_image_file(dir.path()).unwrap_err().to_string().contains("not a file"));
    let text = dir.path().join("notes.txt");
    std::fs::write(&text, b"hello").unwrap();
    assert!(read_image_file(&text).unwrap_err().to_string().contains("not a supported image"));
    assert!(read_image_file(std::path::Path::new("relative.png")).is_err());
}
```

Add `mod task_images; mod task_images_tests;` beside the existing modules in `lib.rs`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml task_images_`
Expected: compile error (`task_images` module missing).

- [ ] **Step 3: Implement the helpers**

In `src-tauri/src/task_images.rs`: match magic bytes (PNG signature, `FF D8 FF`, `GIF8`, `RIFF` + `WEBP` at offset 8); sanitize by replacing path separators and control characters with spaces, collapsing whitespace, trimming, falling back to `image`, truncating to 160 chars on a char boundary; decode base64 with `base64::engine::general_purpose::STANDARD`, checking non-empty, ≤ `MAX_IMAGE_BYTES`, and `sniff_mime_type(&bytes) == Some(input.mime_type)`; `read_image_file` validates absolute path, `metadata.is_file()`, size cap, sniff, and returns base64 + sanitized name.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml task_images_`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/task_images.rs src-tauri/src/task_images_tests.rs src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat(tasks): validate and read task image files"
```

---

### Task 3: Atomic save with images

**Files:**
- Modify: `src-tauri/src/task_store.rs` (create/update/delete + image application)
- Modify: every existing caller of the two save methods: `src-tauri/src/task_store_tests.rs`, `src-tauri/src/git_worktrees_tests.rs`, `src-tauri/src/project_paths_tests.rs`, `src-tauri/src/task_resume.rs` (tests), `src-tauri/src/commands.rs` (tests)
- Test: `src-tauri/src/task_store_tests.rs`

**Interfaces:**
- Consumes: Task 1 types, Task 2 helpers.
- Produces:
  - `TaskStore::create_task(&self, project_id: i64, title: &str, description: &str, images: &[TaskImageInput]) -> anyhow::Result<Task>`
  - `TaskStore::update_task_details(&self, id: i64, title: &str, description: &str, images: &[TaskImageInput]) -> anyhow::Result<Task>`
  - `TaskStore::read_task_image(&self, image_id: i64) -> anyhow::Result<Vec<u8>>`
  - `TaskStore::delete_task` also removes `<image_root>/<task_id>` best-effort.

- [ ] **Step 1: Write the failing tests**

Add these to `src-tauri/src/task_store_tests.rs` (`PNG` and `image_input` are test helpers):

```rust
const PNG: &[u8] = &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];

fn image_input(name: &str, bytes: &[u8]) -> TaskImageInput {
    TaskImageInput {
        image_id: None,
        file_name: name.into(),
        mime_type: TaskImageMimeType::Png,
        data_base64: Some(base64::engine::general_purpose::STANDARD.encode(bytes)),
    }
}

fn kept_input(image: &TaskImage) -> TaskImageInput {
    TaskImageInput {
        image_id: Some(image.id),
        file_name: image.file_name.clone(),
        mime_type: image.mime_type,
        data_base64: None,
    }
}

#[test]
fn create_and_update_apply_the_desired_image_set_atomically() {
    let dir = tempfile::tempdir().unwrap();
    let store = TaskStore::open(&dir.path().join("argis.sqlite")).unwrap();
    let project = store.create_project("/projects/argis").unwrap();

    let task = store
        .create_task(project.id, "Images", "", &[image_input("first.png", PNG), image_input("second.png", b"second")])
        .unwrap();
    assert_eq!(task.images.len(), 2);
    let root = dir.path().join("task-images").join(task.id.to_string());
    assert_eq!(std::fs::read(root.join(task.images[0].id.to_string())).unwrap(), PNG);
    assert_eq!(store.read_task_image(task.images[1].id).unwrap(), b"second");
    assert!(store.read_task_image(9_999).is_err());

    let kept = task.images[1].clone();
    let updated = store
        .update_task_details(task.id, "Images", "", &[kept_input(&kept), image_input("third.png", b"third")])
        .unwrap();
    assert_eq!(updated.images.len(), 2);
    assert_eq!(updated.images[0].id, kept.id);
    assert_eq!(store.read_task_image(kept.id).unwrap(), b"second");
    assert!(!root.join(task.images[0].id.to_string()).exists());

    store.delete_task(task.id).unwrap();
    assert!(!root.exists());
}

#[test]
fn update_at_the_cap_can_remove_and_add_one() {
    // create a task with 12 images, then update with images 1..12 plus one new one:
    // the call succeeds with 12 images and the first id is gone.
}

#[test]
fn rejected_saves_leave_the_task_and_files_untouched() {
    // create a task with one image, then attempt, one at a time:
    //   (a) adding 12 more images (13 total),
    //   (b) a 10 MiB + 1 byte PNG payload,
    //   (c) an imageId from another task,
    //   (d) an imageId together with dataBase64.
    // each call errors, the title and image list are unchanged, and the task
    // image directory still contains exactly one file.
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml task_store_`
Expected: FAIL (wrong arity, missing `read_task_image`).

- [ ] **Step 3: Implement the transaction**

In `task_store.rs`, add a private `apply_task_images(transaction, task_id, inputs) -> anyhow::Result<Vec<PathBuf>>` that:

1. loads the task's existing rows;
2. validates the desired list: no duplicate `imageId`, every `imageId` belongs to this task, kept entries match the stored `file_name`/`mime_type`, `create_task` receives no `imageId`, every new entry decodes through `decode_image_input`;
3. rejects when the final count exceeds `MAX_TASK_IMAGES` or the summed `byte_size` exceeds `MAX_TASK_IMAGE_BYTES`;
4. deletes rows absent from the list and collects their file paths to unlink **after** commit;
5. inserts new rows, then writes each file to `<image_root>/<task_id>/.tmp-<id>` and renames it to `<image_root>/<task_id>/<id>`; on any error, unlinks every file written by this call before returning the error;
6. returns the paths to unlink after commit.

`create_task` / `update_task_details` open `transaction_with_behavior(TransactionBehavior::Immediate)`, update the text, call `apply_task_images`, commit, unlink removed files, and return `task_by_id`. `delete_task` removes the task directory after the row delete, logging failures to stderr. `read_task_image` looks up `task_id` and reads `stored_image_path(...)`.

Then update every existing call site to pass `&[]`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src
git commit -m "feat(tasks): save task images in one transaction"
```

---

### Task 4: Commands, capability, and the contract

**Files:**
- Modify: `src-tauri/src/commands.rs:112-130`, `src-tauri/src/lib.rs:105-129`, `src-tauri/capabilities/default.json`, `src-tauri/Cargo.toml:21`, `docs/CONTRACT.md:15-24`, `:42-48`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `create_task { projectId, title, description, images } -> Task`
  - `update_task_details { id, title, description, images } -> Task`
  - `read_task_image { imageId } -> ArrayBuffer`
  - `read_image_file { path } -> TaskImageFile`

- [ ] **Step 1: Wire the commands**

Add `images: Vec<TaskImageInput>` to both save commands and pass it through `task_store_operation`. Add:

```rust
#[tauri::command]
pub async fn read_task_image(image_id: i64, state: State<'_, TaskStoreState>) -> Result<tauri::ipc::Response, String> {
    let bytes = task_store_operation(state, move |store| store.read_task_image(image_id)).await?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub async fn read_image_file(path: String) -> Result<TaskImageFile, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::task_images::read_image_file(Path::new(&path)).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}
```

Register both in `generate_handler![…]`.

- [ ] **Step 2: Add the build and capability changes**

`src-tauri/Cargo.toml`: `tauri = { version = "2", features = ["image-png"] }`. `capabilities/default.json`: add `"clipboard-manager:allow-write-image"` beside the existing clipboard permission.

- [ ] **Step 3: Update the contract**

In `docs/CONTRACT.md`, change the two save rows to include `images: TaskImageInput[]`, add the two read rows, and add one paragraph: `TaskImage` metadata (id, fileName, mimeType, byteSize), storage under `<database parent>/task-images/<taskId>/<imageId>`, the three caps, the sniffed-MIME rule, and that one save applies text + additions + removals in one transaction.

- [ ] **Step 4: Verify**

Run: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
Expected: no warnings (proves the feature and the new command signatures compile cleanly).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/capabilities/default.json docs/CONTRACT.md
git commit -m "feat(tasks): expose task image commands"
```

---

### Task 5: Frontend wire types, `imageFiles`, sources, and store pass-through

**Files:**
- Modify: `src/domain/types.ts:90-98`, `src/services/agentSource.ts:43-44`, `src/services/tauriAgentSource.ts:94-97`, `src/services/mock/mockAgentSource.ts:94-150`, `src/stores/tasks.ts:110-128`
- Create: `src/domain/imageFiles.ts`, `src/domain/imageFiles.test.ts`
- Test: `src/domain/imageFiles.test.ts`, `src/services/tauriAgentSource.test.ts`, `src/services/mock/mockAgentSource.test.ts`, `src/stores/tasks.test.ts`
- Modify the `Task` fixtures in `src/stores/tasks.test.ts`, `src/domain/tasks.test.ts`, `src/domain/taskTerminalMatch.test.ts`, `src/domain/taskSearch.test.ts`, `src/ui/CommandPalette/paletteResults.test.ts` (add `images: []`) and the save call in `src/ui/Tasks/TaskEditorDialog.vue` (pass `[]` until Task 7).

**Interfaces:**
- Consumes: the Rust commands from Task 4.
- Produces (exact names used by Tasks 6–8):

```ts
export type TaskImageMimeType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export interface TaskImage { id: number; fileName: string; mimeType: TaskImageMimeType; byteSize: number; }

export interface TaskImageInput {
  imageId: number | null;
  fileName: string;
  mimeType: TaskImageMimeType;
  dataBase64: string | null;
}

export interface TaskImageFile {
  fileName: string;
  mimeType: TaskImageMimeType;
  byteSize: number;
  dataBase64: string;
}

export type FileDropEvent = { type: "enter" | "leave" } | { type: "drop"; paths: string[] };
```

`AgentSource` gains/changes:

```ts
createTask(projectId: number, title: string, description: string, images: readonly TaskImageInput[]): Promise<Task>;
updateTaskDetails(id: number, title: string, description: string, images: readonly TaskImageInput[]): Promise<Task>;
readTaskImage(imageId: number): Promise<ArrayBuffer>;
readImageFile(path: string): Promise<TaskImageFile>;
subscribeFileDrop(callback: (event: FileDropEvent) => void): () => void;
```

`src/domain/imageFiles.ts` exports:

```ts
export const TASK_IMAGE_MIME_TYPES: readonly TaskImageMimeType[];
export const MAX_TASK_IMAGES = 12;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_TASK_IMAGE_BYTES = 30 * 1024 * 1024;

export function sniffImageMimeType(bytes: Uint8Array): TaskImageMimeType | null;
export function validateTaskImages(
  kept: readonly { byteSize: number }[],
  added: readonly { fileName: string; byteSize: number }[],
): string | null;
export function bytesToBase64(bytes: Uint8Array): string;
export function base64ToBytes(value: string): Uint8Array;
export function formatByteSize(bytes: number): string;
export function buildTaskImageInputs(
  existing: readonly TaskImage[],
  keptIds: readonly number[],
  added: readonly { fileName: string; mimeType: TaskImageMimeType; dataBase64: string }[],
): TaskImageInput[];
```

`validateTaskImages` takes only the images that will survive the save, so removing one at the cap frees room for one addition.

- [ ] **Step 1: Write the failing tests**

`src/domain/imageFiles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildTaskImageInputs,
  bytesToBase64,
  base64ToBytes,
  formatByteSize,
  MAX_IMAGE_BYTES,
  sniffImageMimeType,
  validateTaskImages,
} from "./imageFiles";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

describe("task image files", () => {
  it("sniffs png, jpeg, gif, webp, and rejects everything else", () => {
    expect(sniffImageMimeType(png)).toBe("image/png");
    expect(sniffImageMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageMimeType(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(sniffImageMimeType(new TextEncoder().encode("RIFF0000WEBP"))).toBe("image/webp");
    expect(sniffImageMimeType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });

  it("round-trips base64 and formats sizes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    expect(formatByteSize(1536)).toBe("1.5 KB");
  });

  it("rejects too many images, oversized images, and an over-budget set", () => {
    const kept = Array.from({ length: 12 }, () => ({ byteSize: 1 }));
    expect(validateTaskImages(kept, [{ fileName: "b.png", byteSize: 1 }])).toContain("12");
    expect(validateTaskImages([], [{ fileName: "big.png", byteSize: MAX_IMAGE_BYTES + 1 }])).toContain("10 MB");
    expect(
      validateTaskImages([], [
        { fileName: "a.png", byteSize: 20 * 1024 * 1024 },
        { fileName: "b.png", byteSize: 11 * 1024 * 1024 },
      ]),
    ).toContain("30 MB");
    expect(validateTaskImages(kept.slice(1), [{ fileName: "c.png", byteSize: 1 }])).toBeNull();
  });

  it("builds kept images first and new images last", () => {
    const existing = [{ id: 4, fileName: "keep.png", mimeType: "image/png" as const, byteSize: 2 }];
    expect(
      buildTaskImageInputs(existing, [4], [{ fileName: "new.png", mimeType: "image/png", dataBase64: "AA==" }]),
    ).toEqual([
      { imageId: 4, fileName: "keep.png", mimeType: "image/png", dataBase64: null },
      { imageId: null, fileName: "new.png", mimeType: "image/png", dataBase64: "AA==" },
    ]);
  });
});
```

`src/services/mock/mockAgentSource.test.ts` add:

```ts
it("imports, reads, and removes task images through the desired set", async () => {
  const source = new MockAgentSource();
  const project = await source.addProject("/projects/argis", false);
  const pngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");
  const task = await source.createTask(project.id, "Images", "", [
    { imageId: null, fileName: "a.png", mimeType: "image/png", dataBase64: pngBase64 },
  ]);
  expect(task.images).toHaveLength(1);
  expect(new Uint8Array(await source.readTaskImage(task.images[0].id))).toEqual(
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  const cleared = await source.updateTaskDetails(task.id, "Images", "", []);
  expect(cleared.images).toEqual([]);
});
```

`src/services/tauriAgentSource.test.ts` add: `createTask` invokes `create_task` with `{ projectId, title, description, images }`, and `readTaskImage(3)` resolves to the mocked `ArrayBuffer`.

`src/stores/tasks.test.ts` add: create/update forward the image list and replace the task in place; a rejected save leaves `tasks.value` unchanged and sets `error`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/domain/imageFiles.test.ts src/services src/stores/tasks.test.ts`
Expected: FAIL (`imageFiles` missing; `images` not on `Task`).

- [ ] **Step 3: Implement the types, the module, and the sources**

- `src/domain/types.ts`: the four types and `Task.images`.
- `src/domain/imageFiles.ts`: magic-byte sniffing mirrored from Rust; `validateTaskImages` returns the first message or `null` (`Only PNG, JPEG, WebP, and GIF images can be attached.`, `A task can hold at most 12 images.`, `<name> is larger than 10 MB.`, `Attached images would exceed 30 MB.`); base64 via `btoa`/`atob` in 0x8000-byte chunks; `formatByteSize` with one decimal for KB/MB.
- `tauriAgentSource.ts`: pass `images` in the invoke args; `readTaskImage` uses `invoke<ArrayBuffer>("read_task_image", { imageId })`; `readImageFile` invokes `read_image_file`; `subscribeFileDrop` calls `getCurrentWebview().onDragDropEvent(...)` (mapping `enter`/`leave`/`drop`) and returns a sync disposer that sets a cancelled flag and, once the async listener resolves, calls the unlisten function.
- `mockAgentSource.ts`: keep a `Map<number, Uint8Array>` of image bytes and a `nextImageId`; apply the desired set in `createTask`/`updateTaskDetails` (throw on a foreign `imageId`, enforce the same caps); return copies from `readTaskImage`; `readImageFile` throws `Reading image files is only available in the Argis desktop app.`; `subscribeFileDrop` returns a no-op disposer.
- `stores/tasks.ts`: pass `images` through to the source.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run && pnpm build`
Expected: all tests PASS and `vue-tsc` reports no errors.

- [ ] **Step 5: Commit**

```bash
git add src/domain src/services src/stores src/ui/Tasks/TaskEditorDialog.vue src/ui/CommandPalette
git commit -m "feat(tasks): add image wire types and sources"
```

---

### Task 6: Clipboard images and previews

**Files:**
- Modify: `src/services/clipboard.ts`
- Create: `src/services/imagePng.ts`, `src/ui/common/CopyButton.vue`, `src/ui/Tasks/TaskImagePreview.vue`, `src/ui/Tasks/TaskImageRow.vue`

**Interfaces:**
- Consumes: `AgentSource.readTaskImage`, `TaskImage`, `formatByteSize`.
- Produces:
  - `writeClipboardImage(pngBytes: Uint8Array): Promise<void>` in `src/services/clipboard.ts`
  - `toPngBytes(blob: Blob): Promise<Uint8Array>` in `src/services/imagePng.ts`
  - `CopyButton` props `{ label: string; copiedLabel: string; copy: () => Promise<void>; showLabel?: boolean; disabled?: boolean }`; renders `Copy`/`Check`/`AlertCircle`, shows the caught message inline on failure, resets after 1.5 s
  - `TaskImagePreview` props `{ image: TaskImage }`, emits `loaded: [blob: Blob]`; renders `<img :alt="image.fileName">`, revokes its URL on unmount, shows a muted placeholder on error
  - `TaskImageRow` props `{ image: TaskImage }`; preview, `fileName · formatByteSize(byteSize)`, and a `CopyButton` that converts the loaded blob with `toPngBytes` and calls `writeClipboardImage`

- [ ] **Step 1: Implement the clipboard and conversion helpers**

`writeClipboardImage`: in Tauri use `writeImage(pngBytes)` from `@tauri-apps/plugin-clipboard-manager`; in the browser use `navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([pngBytes], { type: "image/png" }) })])`. `toPngBytes`: `createImageBitmap(blob)` → canvas at natural size → `ctx.drawImage` → `canvas.toBlob(..., "image/png")` → `arrayBuffer` → `Uint8Array`; throw when `toBlob` returns null.

- [ ] **Step 2: Build the three components**

`CopyButton.vue` owns `status: "idle" | "copied" | "failed"`, resets with `useTimeoutFn` after 1.5 s, catches the rejection into `error`, and renders `<span class="copy-error">{{ error }}</span>` when failed; it is disabled when `disabled` is true. `TaskImagePreview.vue` calls `useAgentSource().readTaskImage` in `onMounted`, stores the object URL in a `ref`, emits `loaded` with the `Blob`, and revokes the URL in `onBeforeUnmount`. `TaskImageRow.vue` keeps the blob from `loaded` and passes the copy handler to `CopyButton`.

All styling uses existing tokens (`--border`, `--radius-card`, `--text-2`, `--text-3`, teal focus ring); any animation touches only opacity/transform.

- [ ] **Step 3: Verify copy in both runtimes**

Run: `pnpm dev`, attach a PNG and a JPEG to a task, click "Copy image" on each, and paste into any image-aware app. Then run `pnpm tauri dev`, repeat, and paste into the Agent tab with Ctrl+V; confirm a picture (not a path) appears.

- [ ] **Step 4: Run the gate for the frontend**

Run: `pnpm build && pnpm exec vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/clipboard.ts src/services/imagePng.ts src/ui/common/CopyButton.vue src/ui/Tasks/TaskImagePreview.vue src/ui/Tasks/TaskImageRow.vue
git commit -m "feat(tasks): copy task images to the clipboard"
```

---

### Task 7: Attachments in the task editor

**Files:**
- Create: `src/composables/useTaskImageAttachments.ts`
- Modify: `src/ui/Tasks/TaskEditorDialog.vue`
- Test: `src/domain/imageFiles.test.ts` (Task 5 already covers validation and list building; this task adds no new pure logic)

**Interfaces:**
- Consumes: Task 5's `AgentSource.createTask/updateTaskDetails/readImageFile/subscribeFileDrop`, `imageFiles.ts`, Task 6's `TaskImagePreview`.
- Produces:

```ts
export interface StagedTaskImage {
  fileName: string;
  mimeType: TaskImageMimeType;
  byteSize: number;
  dataBase64: string;
  previewUrl: string;
}

export function useTaskImageAttachments(): {
  staged: Ref<StagedTaskImage[]>;
  keptIds: Ref<number[]>;
  error: Ref<string | null>;
  dragActive: Ref<boolean>;
  addFiles(files: Iterable<File>, existing: readonly TaskImage[]): Promise<void>;
  addPaths(paths: readonly string[], existing: readonly TaskImage[]): Promise<void>;
  removeStaged(index: number): void;
  removeExisting(imageId: number): void;
  reset(): void;
  inputs(existing: readonly TaskImage[]): TaskImageInput[];
};
```

- [ ] **Step 1: Build the composable**

`addFiles`: for each file, read `arrayBuffer()`, sniff with `sniffImageMimeType`, skip nulls, then `validateTaskImages(existing.filter(kept), [...staged, candidate])`; on failure set `error` and skip that file; on success push `{ ..., dataBase64: bytesToBase64(bytes), previewUrl: URL.createObjectURL(file) }`. `addPaths`: `source.readImageFile(path)` per path, then the same validation and staging (preview URL from `URL.createObjectURL(new Blob([base64ToBytes(data)], { type: mimeType }))`). `keptIds` starts as every existing id and loses one on `removeExisting`. `reset()` revokes every staged `previewUrl`, empties state, and resets `keptIds`. `inputs(existing)` returns `buildTaskImageInputs(existing, keptIds, staged)`.

- [ ] **Step 2: Wire the dialog**

In `TaskEditorDialog.vue`:

- `const attachments = useTaskImageAttachments()`, `const source = useAgentSource()`, `const fileInput = useTemplateRef<HTMLInputElement>("file-input")`, and a local `dropListener: (() => void) | null`;
- on the `open` watcher: `attachments.reset()`; `attachments.keptIds.value = (props.task?.images ?? []).map((image) => image.id)`; subscribe with `source.subscribeFileDrop((event) => { attachments.dragActive.value = event.type !== "leave"; if (event.type === "drop") void attachments.addPaths(event.paths, props.task?.images ?? []); })`; call the disposer on cleanup;
- on the dialog element: `@paste="handlePaste"` (files from `event.clipboardData`), `@dragover.prevent="attachments.dragActive.value = true"`, `@dragleave="attachments.dragActive.value = false"`, `@drop.prevent` (files from `event.dataTransfer`, then `dragActive.value = false`);
- after the description, an "Images" block: a dashed drop-zone button whose click calls `fileInput.click()`, whose label is `Drop images to attach` while `dragActive` and otherwise `Drop, paste, or choose images`; the hidden `<input ref="file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple @change="handleFileInput">`; a thumbnail grid with existing images (kept only) rendered through `TaskImagePreview`, staged images rendered from `previewUrl`, each with a remove button; `attachments.error` in a `role="alert"` paragraph;
- Save: send `attachments.inputs(props.task?.images ?? [])` to `store.createTask(projectId, title, description, inputs)` or `store.updateTaskDetails(id, title, description, inputs)`; on success close and `attachments.reset()`; on failure keep the dialog open (the store sets `store.error`);
- Cancel/close: `attachments.reset()`.

Keep the existing dialog width, radius, focus handling, and button order. Thumbnails are 88x88, `--radius-card`, 1px `--border`, `object-fit: cover`.

- [ ] **Step 3: Verify by hand in the browser mock**

Run: `pnpm dev` and open `http://localhost:1420` (Tasks → New task). Drop a PNG on the dialog, paste a screenshot, click the drop zone and pick two files, remove one, save, reopen the task, and confirm the images persisted. Repeat with a `.txt` file, with a folder, and with a 0-byte file; nothing is attached and the message is readable in each case.

- [ ] **Step 4: Run the gate for the frontend**

Run: `pnpm build && pnpm exec vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useTaskImageAttachments.ts src/ui/Tasks/TaskEditorDialog.vue
git commit -m "feat(tasks): attach images by drop, paste, or file picker"
```

---

### Task 8: Task sheet, Enter to open, and the card badge

**Files:**
- Create: `src/ui/Tasks/TaskSheet.vue`
- Modify: `src/ui/Tasks/TaskCard.vue`, `src/ui/Tasks/TaskBoard.vue`, `src/domain/taskBoardShortcuts.ts`, `docs/design/SPEC.md:144-217`
- Test: `src/domain/taskBoardShortcuts.test.ts`

**Interfaces:**
- Consumes: Tasks 5–7 (`TaskImageRow`, `CopyButton`, `writeClipboardText`).
- Produces:
  - `taskCardViewRequested(event, eventTargetIsCard): boolean` in `src/domain/taskBoardShortcuts.ts`
  - `TaskCard` emits `view`; the card declares `Enter` in `aria-keyshortcuts`
  - `TaskSheet` props `{ task: Task; projectPath: string }`, `v-model:open`, emits `edit`

- [ ] **Step 1: Write the failing test**

In `src/domain/taskBoardShortcuts.test.ts`:

```ts
describe("taskCardViewRequested", () => {
  it("opens only for an unmodified Enter on the card itself", () => {
    expect(taskCardViewRequested(key("Enter"), true)).toBe(true);
    expect(taskCardViewRequested(key("Enter"), false)).toBe(false);
    expect(taskCardViewRequested(key("Enter", { shiftKey: true }), true)).toBe(false);
    expect(taskCardViewRequested(key("Enter", { metaKey: true }), true)).toBe(false);
    expect(taskCardViewRequested(key("Enter", { repeat: true }), true)).toBe(false);
    expect(taskCardViewRequested(key("Enter", { isComposing: true }), true)).toBe(false);
    expect(taskCardViewRequested(key(" "), true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/domain/taskBoardShortcuts.test.ts`
Expected: FAIL (`taskCardViewRequested` is not exported).

- [ ] **Step 3: Implement Enter and the sheet**

- `taskBoardShortcuts.ts`: the pure predicate above, mirroring the module's existing guard style.
- `TaskCard.vue`: in `handleKeydown`, before the navigation branch, `if (taskCardViewRequested(event, event.target === event.currentTarget)) { event.preventDefault(); emit("view"); return; }`. Add the `view` emit and the badge (`ImageIcon` + `task.images.length`) in `.task-card-meta` when non-zero, labelled `"3 images attached"`.
- `TaskBoard.vue`: `sheetOpen` + `sheetTask`, `openTaskSheet(task)`, `@view="openTaskSheet(task)"` on the card, and `<TaskSheet v-if="sheetTask" v-model:open="sheetOpen" :task="sheetTask" :project-path="projectPaths.get(sheetTask.projectId) ?? 'Unknown project'" @edit="editFromSheet" />`; `editFromSheet` closes the sheet and calls `editTask(sheetTask)`. Add "Enter · open task" to the shortcut legend.
- `TaskSheet.vue`: native `<dialog>` with the same backdrop treatment as `TaskEditorDialog`; header (`#id`, project name, status pill, Close), title with a labeled `CopyButton` calling `writeClipboardText(task.title)`, description with `white-space: pre-wrap` and a labeled `CopyButton` (disabled when empty), a list of `TaskImageRow`, and a footer `Edit task` button; focus returns to the opener on close; width `min(680px, calc(100vw - 48px))`.
- `docs/design/SPEC.md`: extend the Task workspace section with the attachment area, Enter -> sheet, the sheet's read-only content and copy actions, and the badge.

- [ ] **Step 4: Verify the sheet in the app**

Run: `pnpm tauri dev`, focus a card with the keyboard, press Enter, confirm the sheet shows title/description/images, copy each part, press Escape, confirm focus is back on the card, then use "Edit task" and confirm the editor opens with the same task.

- [ ] **Step 5: Run the full gate**

Run: `pnpm build && pnpm exec vitest run && cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings && cargo fmt --manifest-path src-tauri/Cargo.toml --check`
Expected: all five pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/Tasks/TaskSheet.vue src/ui/Tasks/TaskCard.vue src/ui/Tasks/TaskBoard.vue src/domain/taskBoardShortcuts.ts src/domain/taskBoardShortcuts.test.ts docs/design/SPEC.md
git commit -m "feat(tasks): open a read-only task sheet with Enter"
```

---

## Self-review notes

- Spec coverage: attachment inputs (Task 7), storage and caps (Tasks 1–3), atomic save (Task 3), transport + capability + feature (Task 4), read/copy (Tasks 5, 6), sheet + Enter + badge (Task 8), docs (Tasks 4, 8).
- The `image-png` feature and `base64` dependency were both approved in the design handoff; Task 4 and Task 2 own them respectively.
- `create_task` arity changes in Task 3, so that task also updates every existing Rust call site.
- The UI validation is kept in step with the Rust cap by taking the surviving images (`kept`) rather than every existing image, which is what makes "remove one, add one at the cap" pass in both layers.
