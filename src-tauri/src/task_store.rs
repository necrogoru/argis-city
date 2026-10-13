use crate::domain::{Project, Task, TaskStatus};
use anyhow::{anyhow, bail, Context};
use parking_lot::Mutex;
use rusqlite::{params, Connection, OptionalExtension, Row, TransactionBehavior};
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;

const SCHEMA_VERSION: i64 = 1;

/// Argis-owned writable data. Provider databases must continue to use the
/// read-only helpers in `shared::sqlite` instead.
pub struct TaskStore {
    connection: Mutex<Connection>,
}

#[derive(Clone)]
pub struct TaskStoreState {
    store: Result<Arc<TaskStore>, String>,
}

impl TaskStoreState {
    pub fn from_path(path: Result<PathBuf, String>) -> Self {
        let store = path.and_then(|path| TaskStore::open(&path).map(Arc::new).map_err(|error| error.to_string()));
        Self { store }
    }

    pub fn store(&self) -> Result<Arc<TaskStore>, String> {
        match &self.store {
            Ok(store) => Ok(Arc::clone(store)),
            Err(error) => Err(error.clone()),
        }
    }
}

impl TaskStore {
    pub fn open(path: &Path) -> anyhow::Result<Self> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).with_context(|| format!("creating {}", parent.display()))?;
        }

        let mut connection = Connection::open(path).with_context(|| format!("opening {}", path.display()))?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        migrate(&mut connection)?;

        Ok(Self { connection: Mutex::new(connection) })
    }

    pub fn create_project(&self, path: &str) -> anyhow::Result<Project> {
        let connection = self.connection.lock();
        connection.execute("INSERT INTO projects (path) VALUES (?1)", [path])?;
        Ok(Project { id: connection.last_insert_rowid(), path: path.to_owned() })
    }

    pub fn list_projects(&self) -> anyhow::Result<Vec<Project>> {
        let connection = self.connection.lock();
        let mut statement = connection.prepare("SELECT id, path FROM projects ORDER BY id")?;
        let rows = statement.query_map([], |row| Ok(Project { id: row.get(0)?, path: row.get(1)? }))?;
        rows.collect::<rusqlite::Result<Vec<_>>>().context("reading projects")
    }

    pub fn create_task(&self, project_id: i64, title: &str, description: &str) -> anyhow::Result<Task> {
        let connection = self.connection.lock();
        connection.execute(
            "INSERT INTO tasks (project_id, title, description, status) VALUES (?1, ?2, ?3, ?4)",
            params![project_id, title, description, TaskStatus::Pending.as_db_value()],
        )?;
        task_by_id(&connection, connection.last_insert_rowid())
    }

    pub fn list_tasks(&self, project_id: Option<i64>) -> anyhow::Result<Vec<Task>> {
        let connection = self.connection.lock();
        let mut statement = connection.prepare(
            "SELECT id, project_id, title, description, status, branch_name, worktree_path
             FROM tasks WHERE (?1 IS NULL OR project_id = ?1) ORDER BY id",
        )?;
        let rows = statement.query_map([project_id], task_from_row)?;
        rows.collect::<rusqlite::Result<Vec<_>>>().context("reading tasks")
    }

    pub fn update_task_details(&self, id: i64, title: &str, description: &str) -> anyhow::Result<Task> {
        let connection = self.connection.lock();
        let changed = connection
            .execute("UPDATE tasks SET title = ?2, description = ?3 WHERE id = ?1", params![id, title, description])?;
        if changed == 0 {
            bail!("task {id} does not exist");
        }
        task_by_id(&connection, id)
    }

    pub fn update_task_status(&self, id: i64, status: TaskStatus) -> anyhow::Result<Task> {
        let connection = self.connection.lock();
        let changed =
            connection.execute("UPDATE tasks SET status = ?2 WHERE id = ?1", params![id, status.as_db_value()])?;
        if changed == 0 {
            bail!("task {id} does not exist");
        }
        task_by_id(&connection, id)
    }

    pub fn delete_task(&self, id: i64) -> anyhow::Result<()> {
        let connection = self.connection.lock();
        let changed = connection.execute("DELETE FROM tasks WHERE id = ?1", [id])?;
        if changed == 0 {
            bail!("task {id} does not exist");
        }
        Ok(())
    }
}

fn migrate(connection: &mut Connection) -> anyhow::Result<()> {
    let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version > SCHEMA_VERSION {
        bail!("database schema version {version} is newer than supported version {SCHEMA_VERSION}");
    }
    if version == SCHEMA_VERSION {
        return Ok(());
    }

    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    transaction.execute_batch(
        "CREATE TABLE projects (
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
        CREATE INDEX tasks_by_project ON tasks(project_id, id);",
    )?;
    transaction.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    transaction.commit()?;
    Ok(())
}

fn task_by_id(connection: &Connection, id: i64) -> anyhow::Result<Task> {
    connection
        .query_row(
            "SELECT id, project_id, title, description, status, branch_name, worktree_path FROM tasks WHERE id = ?1",
            [id],
            task_from_row,
        )
        .optional()?
        .ok_or_else(|| anyhow!("task {id} does not exist"))
}

fn task_from_row(row: &Row<'_>) -> rusqlite::Result<Task> {
    let status_value: String = row.get(4)?;
    let status = TaskStatus::from_db_value(&status_value)
        .ok_or_else(|| rusqlite::Error::InvalidColumnType(4, "status".to_owned(), rusqlite::types::Type::Text))?;
    Ok(Task {
        id: row.get(0)?,
        project_id: row.get(1)?,
        title: row.get(2)?,
        description: row.get(3)?,
        status,
        branch_name: row.get(5)?,
        worktree_path: row.get(6)?,
    })
}
