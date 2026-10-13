use crate::domain::TaskStatus;
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

    assert_eq!(version, 1);
}

#[test]
fn task_store_rejects_a_newer_unknown_schema_version() {
    let dir = tempfile::tempdir().unwrap();
    let database_path = dir.path().join("argis.sqlite");
    let connection = Connection::open(&database_path).unwrap();
    connection.pragma_update(None, "user_version", 2).unwrap();
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
