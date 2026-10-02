//! Codex's thread index: newest `~/.codex/state_*.sqlite`.

use crate::shared::sqlite::{column_or, has_table, open_read_only};
use rusqlite::{Connection, Row};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq)]
pub struct ThreadRow {
    pub id: String,
    pub rollout_path: PathBuf,
    pub cwd: PathBuf,
    pub title: String,
    pub name: Option<String>,
    pub model: Option<String>,
    pub tokens_used: u64,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
    pub nickname: Option<String>,
    pub role: Option<String>,
}

/// `state_<n>.sqlite` with the highest `n`.
pub fn newest_state_db(root: &Path) -> Option<PathBuf> {
    fs::read_dir(root)
        .ok()?
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().into_string().ok()?;
            let n = name.strip_prefix("state_")?.strip_suffix(".sqlite")?.parse::<u32>().ok()?;
            Some((n, e.path()))
        })
        .max_by_key(|(n, _)| *n)
        .map(|(_, p)| p)
}

pub struct CodexIndex {
    conn: Connection,
    columns: String,
    updated_expr: String,
    has_edges: bool,
}

impl CodexIndex {
    pub fn open(path: &Path) -> anyhow::Result<Self> {
        let conn = open_read_only(path)?;
        let col = |name: &str, fallback: &str| format!("{} AS {name}", column_or(&conn, "threads", name, fallback));
        let updated_expr =
            format!("COALESCE({}, t.updated_at * 1000)", column_or(&conn, "threads", "updated_at_ms", "NULL"));
        let columns = [
            "t.id".to_string(),
            "t.rollout_path".into(),
            "t.cwd".into(),
            "t.title".into(),
            col("name", "NULL"),
            col("model", "NULL"),
            "t.tokens_used".into(),
            format!("COALESCE({}, t.created_at * 1000)", column_or(&conn, "threads", "created_at_ms", "NULL")),
            updated_expr.clone(),
            col("agent_nickname", "NULL"),
            col("agent_role", "NULL"),
        ]
        .join(", ");
        let has_edges = has_table(&conn, "thread_spawn_edges");
        Ok(Self { conn, columns, updated_expr, has_edges })
    }

    /// Unarchived top-level threads updated at/after `since_ms`.
    pub fn recent_threads(&self, since_ms: i64) -> anyhow::Result<Vec<ThreadRow>> {
        let not_child = match self.has_edges {
            true => "AND t.id NOT IN (SELECT child_thread_id FROM thread_spawn_edges)",
            false => "",
        };
        let sql = format!(
            "SELECT {} FROM threads t WHERE t.archived = 0 AND {} >= ?1 {not_child}",
            self.columns, self.updated_expr
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map([since_ms], thread_row)?;
        Ok(rows.flatten().collect())
    }

    /// Direct children of `parent` with their spawn-edge status.
    pub fn children(&self, parent: &str) -> anyhow::Result<Vec<(String, ThreadRow)>> {
        if !self.has_edges {
            return Ok(Vec::new());
        }
        let sql = format!(
            "SELECT {}, e.status FROM thread_spawn_edges e \
             JOIN threads t ON t.id = e.child_thread_id WHERE e.parent_thread_id = ?1",
            self.columns
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map([parent], |r| Ok((r.get::<_, String>(11)?, thread_row(r)?)))?;
        Ok(rows.flatten().collect())
    }
}

fn thread_row(r: &Row) -> rusqlite::Result<ThreadRow> {
    Ok(ThreadRow {
        id: r.get(0)?,
        rollout_path: PathBuf::from(r.get::<_, String>(1)?),
        cwd: PathBuf::from(r.get::<_, String>(2)?),
        title: r.get(3)?,
        name: r.get(4)?,
        model: r.get(5)?,
        tokens_used: r.get::<_, i64>(6)?.max(0) as u64,
        created_at_ms: r.get(7)?,
        updated_at_ms: r.get(8)?,
        nickname: r.get(9)?,
        role: r.get(10)?,
    })
}
