use crate::domain::{Project, ProviderId, Task, TaskAgentResume, TaskImage, TaskImageMimeType, TaskStatus};
use anyhow::{anyhow, bail, Context};
use parking_lot::Mutex;
use rusqlite::{params, Connection, OptionalExtension, Row, TransactionBehavior};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;

const SCHEMA_VERSION: i64 = 3;

/// Argis-owned writable data. Provider databases must continue to use the
/// read-only helpers in `shared::sqlite` instead.
pub struct TaskStore {
    connection: Mutex<Connection>,
    /// Task image bytes, derived from the database directory and never from a task field.
    image_root: PathBuf,
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
        let image_root = path.parent().map(|parent| parent.join("task-images")).unwrap_or_else(|| PathBuf::from("task-images"));

        Ok(Self { connection: Mutex::new(connection), image_root })
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

    pub fn get_project(&self, id: i64) -> anyhow::Result<Project> {
        let connection = self.connection.lock();
        connection
            .query_row("SELECT id, path FROM projects WHERE id = ?1", [id], |row| {
                Ok(Project { id: row.get(0)?, path: row.get(1)? })
            })
            .optional()?
            .ok_or_else(|| anyhow!("project {id} does not exist"))
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
        let mut images = images_by_task(&connection, project_id)?;
        let mut statement = connection.prepare(
            "SELECT id, project_id, title, description, status, branch_name, worktree_path
             FROM tasks WHERE (?1 IS NULL OR project_id = ?1) ORDER BY id",
        )?;
        let rows = statement.query_map([project_id], task_from_row)?;
        let tasks = rows.collect::<rusqlite::Result<Vec<_>>>().context("reading tasks")?;
        Ok(tasks
            .into_iter()
            .map(|mut task| {
                task.images = images.remove(&task.id).unwrap_or_default();
                task
            })
            .collect())
    }

    pub fn get_task(&self, id: i64) -> anyhow::Result<Task> {
        let connection = self.connection.lock();
        task_by_id(&connection, id)
    }

    pub fn save_task_agent_resume(&self, reference: &TaskAgentResume) -> anyhow::Result<()> {
        if reference.native_reference.trim().is_empty() {
            bail!("agent resume reference must not be empty");
        }
        if !Path::new(&reference.worktree_path).is_absolute() {
            bail!("agent resume worktree path must be absolute");
        }
        if reference.last_observed_at_ms < 0 {
            bail!("agent resume timestamp must be non-negative");
        }

        let connection = self.connection.lock();
        connection.execute(
            "INSERT INTO task_agent_resume (task_id, provider, native_reference, worktree_path, last_observed_at_ms)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(task_id) DO UPDATE SET
                provider = excluded.provider,
                native_reference = excluded.native_reference,
                worktree_path = excluded.worktree_path,
                last_observed_at_ms = excluded.last_observed_at_ms",
            params![
                reference.task_id,
                reference.provider.as_str(),
                reference.native_reference,
                reference.worktree_path,
                reference.last_observed_at_ms
            ],
        )?;
        Ok(())
    }

    pub fn get_task_agent_resume(&self, task_id: i64) -> anyhow::Result<Option<TaskAgentResume>> {
        let connection = self.connection.lock();
        connection
            .query_row(
                "SELECT task_id, provider, native_reference, worktree_path, last_observed_at_ms
                 FROM task_agent_resume WHERE task_id = ?1",
                [task_id],
                task_agent_resume_from_row,
            )
            .optional()
            .context("reading task agent resume reference")
    }

    pub fn list_task_agent_resumes(&self) -> anyhow::Result<Vec<TaskAgentResume>> {
        let connection = self.connection.lock();
        let mut statement = connection.prepare(
            "SELECT task_id, provider, native_reference, worktree_path, last_observed_at_ms
             FROM task_agent_resume ORDER BY task_id",
        )?;
        let rows = statement.query_map([], task_agent_resume_from_row)?;
        rows.collect::<rusqlite::Result<Vec<_>>>().context("reading task agent resume references")
    }

    pub fn set_task_worktree(&self, id: i64, branch_name: &str, worktree_path: &str) -> anyhow::Result<Task> {
        let connection = self.connection.lock();
        let changed = connection.execute(
            "UPDATE tasks SET branch_name = ?2, worktree_path = ?3
             WHERE id = ?1 AND branch_name IS NULL AND worktree_path IS NULL",
            params![id, branch_name, worktree_path],
        )?;
        if changed == 0 {
            bail!("task {id} does not exist or already has a Git worktree");
        }
        task_by_id(&connection, id)
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
    if version == 0 {
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
    }
    if version < 2 {
        transaction.execute_batch(
            "CREATE TABLE task_agent_resume (
                task_id INTEGER PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
                provider TEXT NOT NULL CHECK (provider IN ('claude', 'codex', 'opencode', 'pi')),
                native_reference TEXT NOT NULL CHECK (length(native_reference) > 0),
                worktree_path TEXT NOT NULL CHECK (length(worktree_path) > 0),
                last_observed_at_ms INTEGER NOT NULL CHECK (last_observed_at_ms >= 0)
            );",
        )?;
    }
    if version < 3 {
        transaction.execute_batch(
            "CREATE TABLE task_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 160),
                mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
                byte_size INTEGER NOT NULL CHECK (byte_size > 0)
            );
            CREATE INDEX task_images_by_task ON task_images(task_id, id);",
        )?;
    }
    transaction.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    transaction.commit()?;
    Ok(())
}

fn task_by_id(connection: &Connection, id: i64) -> anyhow::Result<Task> {
    let mut task = connection
        .query_row(
            "SELECT id, project_id, title, description, status, branch_name, worktree_path FROM tasks WHERE id = ?1",
            [id],
            task_from_row,
        )
        .optional()?
        .ok_or_else(|| anyhow!("task {id} does not exist"))?;
    task.images = images_for_task(connection, id)?;
    Ok(task)
}

fn images_by_task(connection: &Connection, project_id: Option<i64>) -> anyhow::Result<HashMap<i64, Vec<TaskImage>>> {
    let mut statement = connection.prepare(
        "SELECT i.id, i.task_id, i.file_name, i.mime_type, i.byte_size
         FROM task_images i JOIN tasks t ON t.id = i.task_id
         WHERE (?1 IS NULL OR t.project_id = ?1) ORDER BY i.id",
    )?;
    let rows = statement.query_map([project_id], |row| {
        let image = TaskImage {
            id: row.get(0)?,
            file_name: row.get(2)?,
            mime_type: image_mime_type(row, 3)?,
            byte_size: row.get(4)?,
        };
        Ok((row.get::<_, i64>(1)?, image))
    })?;
    let mut images: HashMap<i64, Vec<TaskImage>> = HashMap::new();
    for row in rows {
        let (task_id, image) = row?;
        images.entry(task_id).or_default().push(image);
    }
    Ok(images)
}

fn images_for_task(connection: &Connection, task_id: i64) -> anyhow::Result<Vec<TaskImage>> {
    let mut statement =
        connection.prepare("SELECT id, file_name, mime_type, byte_size FROM task_images WHERE task_id = ?1 ORDER BY id")?;
    let rows = statement.query_map([task_id], |row| {
        Ok(TaskImage { id: row.get(0)?, file_name: row.get(1)?, mime_type: image_mime_type(row, 2)?, byte_size: row.get(3)? })
    })?;
    rows.collect::<rusqlite::Result<Vec<_>>>().context("reading task images")
}

fn image_mime_type(row: &Row<'_>, index: usize) -> rusqlite::Result<TaskImageMimeType> {
    let value: String = row.get(index)?;
    TaskImageMimeType::from_db_value(&value)
        .ok_or_else(|| rusqlite::Error::InvalidColumnType(index, "mime_type".to_owned(), rusqlite::types::Type::Text))
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
        images: Vec::new(),
    })
}

fn task_agent_resume_from_row(row: &Row<'_>) -> rusqlite::Result<TaskAgentResume> {
    let provider_value: String = row.get(1)?;
    let provider = ProviderId::from_str(&provider_value)
        .ok_or_else(|| rusqlite::Error::InvalidColumnType(1, "provider".to_owned(), rusqlite::types::Type::Text))?;
    Ok(TaskAgentResume {
        task_id: row.get(0)?,
        provider,
        native_reference: row.get(2)?,
        worktree_path: row.get(3)?,
        last_observed_at_ms: row.get(4)?,
    })
}
