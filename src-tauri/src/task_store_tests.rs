use crate::domain::{ProviderId, TaskAgentResume, TaskStatus};
use crate::task_store::{TaskStore, TaskStoreState};
use rusqlite::Connection;

#[test]
fn task_store_persists_projects_tasks_and_updates_across_reopen() {
    let dir = tempfile::tempdir().unwrap();
    let database_path = dir.path().join("argis.sqlite");

    let store = TaskStore::open(&database_path).unwrap();
    let project = store.create_project("/projects/argis").unwrap();
    let task = store.create_task(project.id, "Add task board", "Create the board UI").unwrap();
    let edited = store.update_task_details(task.id, "Build task board", "Add project filtering").unwrap();
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
    let task = store.create_task(project.id, "Resume", "").unwrap();
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
