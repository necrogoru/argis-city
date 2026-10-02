//! Read-only queries over `~/.local/share/opencode/opencode.db`.

use crate::domain::TokenUsage;
use crate::shared::sqlite::{column_or, open_read_only};
use rusqlite::{Connection, Row};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq)]
pub struct SessionRow {
    pub id: String,
    pub directory: PathBuf,
    pub title: String,
    /// Raw JSON, e.g. `{"id":"gpt-6-luna","providerID":"…"}`.
    pub model: Option<String>,
    pub agent: Option<String>,
    pub tokens: TokenUsage,
    pub time_created: i64,
    pub time_updated: i64,
}

pub struct OpenCodeStore {
    conn: Connection,
    columns: String,
}

impl OpenCodeStore {
    pub fn open(path: &Path) -> anyhow::Result<Self> {
        let conn = open_read_only(path)?;
        let col = |name: &str, fallback: &str| column_or(&conn, "session", name, fallback);
        let columns = format!(
            "id, directory, title, {}, {}, {}, {}, {}, {}, time_created, time_updated",
            col("model", "NULL"),
            col("agent", "NULL"),
            col("tokens_input", "0"),
            col("tokens_output", "0"),
            col("tokens_cache_read", "0"),
            col("tokens_cache_write", "0"),
        );
        Ok(Self { conn, columns })
    }

    /// Unarchived root sessions updated at/after `since_ms`.
    pub fn recent_roots(&self, since_ms: i64) -> anyhow::Result<Vec<SessionRow>> {
        let sql = format!(
            "SELECT {} FROM session WHERE parent_id IS NULL AND time_archived IS NULL AND time_updated >= ?1",
            self.columns
        );
        self.sessions(&sql, rusqlite::params![since_ms])
    }

    /// Child (subagent) sessions of `parent`.
    pub fn children(&self, parent: &str) -> anyhow::Result<Vec<SessionRow>> {
        let sql = format!("SELECT {} FROM session WHERE parent_id = ?1 AND time_archived IS NULL", self.columns);
        self.sessions(&sql, rusqlite::params![parent])
    }

    /// `message.data` JSON, newest first.
    pub fn latest_messages(&self, session: &str, limit: u32) -> anyhow::Result<Vec<String>> {
        self.strings(
            "SELECT data FROM message WHERE session_id = ?1 ORDER BY time_created DESC, id DESC LIMIT ?2",
            session,
            limit,
        )
    }

    /// `part.data` JSON, newest first.
    pub fn latest_parts(&self, session: &str, limit: u32) -> anyhow::Result<Vec<String>> {
        self.strings(
            "SELECT data FROM part WHERE session_id = ?1 ORDER BY time_created DESC, id DESC LIMIT ?2",
            session,
            limit,
        )
    }

    pub fn todo_statuses(&self, session: &str) -> anyhow::Result<Vec<String>> {
        let mut stmt = self.conn.prepare("SELECT status FROM todo WHERE session_id = ?1 ORDER BY position")?;
        let rows = stmt.query_map([session], |r| r.get::<_, String>(0))?;
        Ok(rows.flatten().collect())
    }

    fn strings(&self, sql: &str, session: &str, limit: u32) -> anyhow::Result<Vec<String>> {
        let mut stmt = self.conn.prepare(sql)?;
        let rows = stmt.query_map(rusqlite::params![session, limit], |r| r.get::<_, String>(0))?;
        Ok(rows.flatten().collect())
    }

    fn sessions(&self, sql: &str, params: impl rusqlite::Params) -> anyhow::Result<Vec<SessionRow>> {
        let mut stmt = self.conn.prepare(sql)?;
        let rows = stmt.query_map(params, session_row)?;
        Ok(rows.flatten().collect())
    }
}

fn session_row(r: &Row) -> rusqlite::Result<SessionRow> {
    let n = |i: usize| r.get::<_, Option<i64>>(i).map(|v| v.unwrap_or(0).max(0) as u64);
    Ok(SessionRow {
        id: r.get(0)?,
        directory: PathBuf::from(r.get::<_, String>(1)?),
        title: r.get(2)?,
        model: r.get(3)?,
        agent: r.get(4)?,
        tokens: TokenUsage::new(n(5)?, n(6)?, n(7)?, n(8)?),
        time_created: r.get(9)?,
        time_updated: r.get(10)?,
    })
}
