use crate::domain::{ProviderId, TaskAgentResume, TaskImage, TaskImageMimeType, TaskStatus};
use crate::task_store::{TaskStore, TaskStoreState};
use base64::Engine;
use rusqlite::Connection;

const PNG: &[u8] = &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];

fn image_input(name: &str, bytes: &[u8]) -> crate::domain::TaskImageInput {
    crate::domain::TaskImageInput {
        image_id: None,
        file_name: name.into(),
        mime_type: TaskImageMimeType::Png,
        data_base64: Some(base64::engine::general_purpose::STANDARD.encode(bytes)),
    }
}

fn png_bytes(payload: &[u8]) -> Vec<u8> {
    let mut bytes = PNG.to_vec();
    bytes.extend_from_slice(payload);
    bytes
}

fn kept_input(image: &TaskImage) -> crate::domain::TaskImageInput {
    crate::domain::TaskImageInput {
        image_id: Some(image.id),
        file_name: image.file_name.clone(),
        mime_type: image.mime_type,
        data_base64: None,
    }
}

#[test]
fn task_store_persists_projects_tasks_and_updates_across_reopen() {
    let dir = tempfile::tempdir().unwrap();
    let database_path = dir.path().join("argis.sqlite");

    let store = TaskStore::open(&database_path).unwrap();
    let project = store.create_project("/projects/argis").unwrap();
    let task = store.create_task(project.id, "Add task board", "Create the board UI", &[]).unwrap();
    let edited = store.update_task_details(task.id, "Build task board", "Add project filtering", &[]).unwrap();
    let updated = store.update_task_status(task.id, TaskStatus::InProgress).unwrap();

    assert_eq!(task.status, TaskStatus::Pending);
    assert_eq!(edited.id, task.id);
    assert_eq!(updated.status, TaskStatus::InProgress);
    drop(store);

    let reopened = TaskStore::open(&database_path).unwrap();
    let projects = reopened.list_projects().unwrap();
    let tasks = reopened.list_tasks(Some(project.id)).unwrap();

    assert_eq!(projects, vec![project]);
    assert_eq!(tasks.len(), 1);
    assert_eq!(tasks[0].id, task.id);
    assert_eq!(tasks[0].title, "Build task board");
    assert_eq!(tasks[0].description, "Add project filtering");
    assert_eq!(tasks[0].status, TaskStatus::InProgress);
    assert!(tasks[0].branch_name.is_none());
    assert!(tasks[0].worktree_path.is_none());

    reopened.delete_task(task.id).unwrap();
    assert!(reopened.list_tasks(None).unwrap().is_empty());
}

#[test]
fn task_store_records_schema_version() {
    let dir = tempfile::tempdir().unwrap();
    let database_path = dir.path().join("argis.sqlite");

    let _store = TaskStore::open(&database_path).unwrap();
    let connection = Connection::open(database_path).unwrap();
    let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0)).unwrap();

    assert_eq!(version, 3);
}

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
        .query_row("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'task_images'", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(tables, 1);
}

#[test]
fn task_store_reads_images_with_tasks_in_id_order() {
    let dir = tempfile::tempdir().unwrap();
    let database_path = dir.path().join("argis.sqlite");
    let store = TaskStore::open(&database_path).unwrap();
    let project = store.create_project("/projects/argis").unwrap();
    let task = store.create_task(project.id, "With images", "", &[]).unwrap();

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

#[test]
fn task_store_migrates_v1_and_persists_one_replaceable_resume_reference_per_task() {
    let dir = tempfile::tempdir().unwrap();
    let database_path = dir.path().join("argis.sqlite");
    let legacy = Connection::open(&database_path).unwrap();
    legacy
        .execute_batch(
            "PRAGMA foreign_keys = ON;
         CREATE TABLE projects (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             path TEXT NOT NULL UNIQUE
         );
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
         INSERT INTO projects (id, path) VALUES (1, '/projects/argis');
         INSERT INTO tasks (id, project_id, title, description, status, branch_name, worktree_path)
         VALUES (7, 1, 'Resume task', '', 'inProgress', 'feature', '/worktrees/task');
         PRAGMA user_version = 1;",
        )
        .unwrap();
    drop(legacy);

    let store = TaskStore::open(&database_path).unwrap();
    assert_eq!(store.get_task(7).unwrap().title, "Resume task");

    let connection = Connection::open(&database_path).unwrap();
    let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0)).unwrap();
    assert_eq!(version, 3);

    connection
        .execute(
            "INSERT INTO task_agent_resume (task_id, provider, native_reference, worktree_path, last_observed_at_ms)
             VALUES (7, 'claude', 'session-old', '/worktrees/task', 100)",
            [],
        )
        .unwrap();
    connection
        .execute(
            "INSERT INTO task_agent_resume (task_id, provider, native_reference, worktree_path, last_observed_at_ms)
             VALUES (7, 'codex', 'session-new', '/worktrees/task', 200)
             ON CONFLICT(task_id) DO UPDATE SET
                provider = excluded.provider,
                native_reference = excluded.native_reference,
                worktree_path = excluded.worktree_path,
                last_observed_at_ms = excluded.last_observed_at_ms",
            [],
        )
        .unwrap();
    let saved: (String, String, String, i64) = connection
        .query_row(
            "SELECT provider, native_reference, worktree_path, last_observed_at_ms
             FROM task_agent_resume WHERE task_id = 7",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .unwrap();
    assert_eq!(saved, ("codex".into(), "session-new".into(), "/worktrees/task".into(), 200));

    store.delete_task(7).unwrap();
    let remaining: i64 =
        connection.query_row("SELECT COUNT(*) FROM task_agent_resume WHERE task_id = 7", [], |row| row.get(0)).unwrap();
    assert_eq!(remaining, 0);
}

#[test]
fn task_store_round_trips_typed_agent_resume_references_and_serializes_the_wire_contract() {
    let dir = tempfile::tempdir().unwrap();
    let store = TaskStore::open(&dir.path().join("argis.sqlite")).unwrap();
    let project = store.create_project("/projects/argis").unwrap();
    let task = store.create_task(project.id, "Resume", "", &[]).unwrap();
    let reference = TaskAgentResume {
        task_id: task.id,
        provider: ProviderId::Claude,
        native_reference: "opaque-session-id".to_owned(),
        worktree_path: "/projects/argis/.argis/worktrees/1-resume".to_owned(),
        last_observed_at_ms: 1_780_000_000_123,
    };

    store.save_task_agent_resume(&reference).unwrap();
    assert_eq!(store.get_task_agent_resume(task.id).unwrap(), Some(reference.clone()));
    assert_eq!(store.list_task_agent_resumes().unwrap(), vec![reference.clone()]);

    let replacement = TaskAgentResume {
        provider: ProviderId::Codex,
        native_reference: "new-session-id".to_owned(),
        last_observed_at_ms: 1_780_000_000_456,
        ..reference.clone()
    };
    store.save_task_agent_resume(&replacement).unwrap();
    assert_eq!(store.get_task_agent_resume(task.id).unwrap(), Some(replacement.clone()));
    assert_eq!(store.list_task_agent_resumes().unwrap(), vec![replacement]);

    assert_eq!(
        serde_json::to_value(&reference).unwrap(),
        serde_json::json!({
            "taskId": task.id,
            "provider": "claude",
            "nativeReference": "opaque-session-id",
            "worktreePath": "/projects/argis/.argis/worktrees/1-resume",
            "lastObservedAtMs": 1_780_000_000_123_i64
        })
    );
}

#[test]
fn task_store_rejects_a_newer_unknown_schema_version() {
    let dir = tempfile::tempdir().unwrap();
    let database_path = dir.path().join("argis.sqlite");
    let connection = Connection::open(&database_path).unwrap();
    connection.pragma_update(None, "user_version", 4).unwrap();
    drop(connection);

    let error = TaskStore::open(&database_path).err().expect("newer schema version should fail to open");

    assert!(error.to_string().contains("schema version"));
}

#[test]
fn task_status_uses_camel_case_wire_values() {
    assert_eq!(serde_json::to_value(TaskStatus::InProgress).unwrap(), "inProgress");
    assert_eq!(serde_json::from_value::<TaskStatus>(serde_json::json!("canceled")).unwrap(), TaskStatus::Canceled);
}

#[test]
fn task_store_state_retains_initialization_errors_for_task_commands() {
    let state = TaskStoreState::from_path(Err("application data directory is unavailable".to_owned()));

    assert_eq!(state.store().err().as_deref(), Some("application data directory is unavailable"));
}

#[test]
fn create_and_update_apply_the_desired_image_set_atomically() {
    let dir = tempfile::tempdir().unwrap();
    let store = TaskStore::open(&dir.path().join("argis.sqlite")).unwrap();
    let project = store.create_project("/projects/argis").unwrap();

    let task = store
        .create_task(
            project.id,
            "Images",
            "",
            &[image_input("first.png", PNG), image_input("second.png", &png_bytes(b"second"))],
        )
        .unwrap();
    assert_eq!(task.images.len(), 2);
    let root = dir.path().join("task-images").join(task.id.to_string());
    assert_eq!(std::fs::read(root.join(task.images[0].id.to_string())).unwrap(), PNG);
    assert_eq!(store.read_task_image(task.images[1].id).unwrap(), png_bytes(b"second"));
    assert!(store.read_task_image(9_999).is_err());

    let kept = task.images[1].clone();
    let updated = store
        .update_task_details(
            task.id,
            "Images",
            "",
            &[kept_input(&kept), image_input("third.png", &png_bytes(b"third"))],
        )
        .unwrap();
    assert_eq!(updated.images.len(), 2);
    assert_eq!(updated.images[0].id, kept.id);
    assert_eq!(store.read_task_image(kept.id).unwrap(), png_bytes(b"second"));
    assert!(!root.join(task.images[0].id.to_string()).exists());

    store.delete_task(task.id).unwrap();
    assert!(!root.exists());
}

#[test]
fn update_at_the_cap_can_remove_and_add_one() {
    let dir = tempfile::tempdir().unwrap();
    let store = TaskStore::open(&dir.path().join("argis.sqlite")).unwrap();
    let project = store.create_project("/projects/argis").unwrap();
    let images: Vec<_> = (0..12).map(|index| image_input(&format!("{index}.png"), PNG)).collect();
    let task = store.create_task(project.id, "Full", "", &images).unwrap();
    assert_eq!(task.images.len(), 12);

    let mut desired: Vec<_> = task.images.iter().skip(1).map(kept_input).collect();
    desired.push(image_input("extra.png", PNG));
    let updated = store.update_task_details(task.id, "Full", "", &desired).unwrap();

    assert_eq!(updated.images.len(), 12);
    assert!(!updated.images.iter().any(|image| image.id == task.images[0].id));
}

#[test]
fn rejected_saves_leave_the_task_and_files_untouched() {
    let dir = tempfile::tempdir().unwrap();
    let store = TaskStore::open(&dir.path().join("argis.sqlite")).unwrap();
    let project = store.create_project("/projects/argis").unwrap();
    let task = store.create_task(project.id, "Guarded", "", &[image_input("only.png", PNG)]).unwrap();
    let root = dir.path().join("task-images").join(task.id.to_string());

    let mut over_cap: Vec<_> = (0..12).map(|index| image_input(&format!("{index}.png"), PNG)).collect();
    over_cap.insert(0, kept_input(&task.images[0]));

    let mut oversized_bytes = PNG.to_vec();
    oversized_bytes.resize(10 * 1024 * 1024 + 1, 0);

    let other_task =
        store.create_task(project.id, "Other", "", &[image_input("other.png", &png_bytes(b"other"))]).unwrap();

    let mut id_with_data = kept_input(&task.images[0]);
    id_with_data.data_base64 = Some(base64::engine::general_purpose::STANDARD.encode(PNG));

    let attempts = vec![
        over_cap,
        vec![kept_input(&task.images[0]), image_input("huge.png", &oversized_bytes)],
        vec![kept_input(&task.images[0]), kept_input(&other_task.images[0])],
        vec![id_with_data],
    ];

    for desired in attempts {
        assert!(store.update_task_details(task.id, "Guarded", "", &desired).is_err());
        let current = store.get_task(task.id).unwrap();
        assert_eq!(current.title, "Guarded");
        assert_eq!(current.images.len(), 1);
        assert_eq!(current.images[0].id, task.images[0].id);
        assert_eq!(std::fs::read_dir(&root).unwrap().count(), 1);
    }
}

#[test]
fn a_failed_image_write_leaves_no_rows_and_no_stray_files() {
    let dir = tempfile::tempdir().unwrap();
    let store = TaskStore::open(&dir.path().join("argis.sqlite")).unwrap();
    let project = store.create_project("/projects/argis").unwrap();
    // A fresh database hands the task and image id 1 to this save; make the
    // destination a directory so the temp file cannot be renamed into place.
    let blocked = dir.path().join("task-images").join("1").join("1");
    std::fs::create_dir_all(&blocked).unwrap();

    let error = store.create_task(project.id, "Blocked", "", &[image_input("a.png", PNG)]).unwrap_err();

    assert!(error.to_string().contains("storing"), "{error}");
    assert!(store.list_tasks(None).unwrap().is_empty());
    let entries = std::fs::read_dir(dir.path().join("task-images").join("1")).unwrap().count();
    assert_eq!(entries, 1, "only the pre-created directory should remain");
}
