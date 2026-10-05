//! Read-only queries over `~/.local/share/opencode/opencode.db`, across both
//! storage layouts (see `layout.rs`).

use super::layout::{inline_parts, normalize_message, Layout};
use crate::domain::TokenUsage;
use crate::shared::sqlite::{column_or, has_table, open_read_only};
use rusqlite::{Connection, Row};
use serde_json::Value;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

const MESSAGE_LOOKBACK: u32 = 8;
const PART_LOOKBACK: u32 = 24;

#[derive(Debug, Clone, PartialEq)]
pub struct SessionRow {
    pub id: String,
    pub layout: Layout,
    pub directory: PathBuf,
    pub title: String,
    /// Raw JSON, e.g. `{"id":"gpt-6-luna","providerID":"…"}`.
    pub model: Option<String>,
    pub agent: Option<String>,
    pub tokens: TokenUsage,
    pub time_created: i64,
    pub time_updated: i64,
}

/// Newest-first messages (legacy shape) and parts of one session.
pub struct Activity {
    pub messages: Vec<Value>,
    pub parts: Vec<Value>,
}

pub struct OpenCodeStore {
    conn: Connection,
    /// Layouts present in this DB, with their tolerant SELECT column list.
    layouts: Vec<(Layout, String)>,
}

impl OpenCodeStore {
    pub fn open(path: &Path) -> anyhow::Result<Self> {
        let conn = open_read_only(path)?;
        let layouts = Layout::ALL
            .into_iter()
            .filter(|l| has_table(&conn, l.session_table()) && has_table(&conn, l.message_table()))
            .map(|l| (l, select_columns(&conn, l.session_table())))
            .collect();
        Ok(Self { conn, layouts })
    }

    /// Unarchived root sessions updated at/after `since_ms`, from every layout.
    pub fn recent_roots(&self, since_ms: i64) -> anyhow::Result<Vec<SessionRow>> {
        let mut seen = HashSet::new();
        let mut rows = Vec::new();
        for (layout, columns) in &self.layouts {
            let sql = format!(
                "SELECT {columns} FROM {} WHERE parent_id IS NULL AND time_archived IS NULL AND time_updated >= ?1",
                layout.session_table()
            );
            let found = self.sessions(*layout, &sql, rusqlite::params![since_ms])?;
            rows.extend(found.into_iter().filter(|r| seen.insert(r.id.clone())));
        }
        Ok(rows)
    }

    /// Child (subagent) sessions of `parent`, from the parent's layout.
    pub fn children(&self, parent: &SessionRow) -> anyhow::Result<Vec<SessionRow>> {
        let Some((layout, columns)) = self.layouts.iter().find(|(l, _)| *l == parent.layout) else {
            return Ok(Vec::new());
        };
        let table = layout.session_table();
        let sql = format!("SELECT {columns} FROM {table} WHERE parent_id = ?1 AND time_archived IS NULL");
        self.sessions(*layout, &sql, rusqlite::params![parent.id])
    }

    pub fn activity(&self, row: &SessionRow) -> anyhow::Result<Activity> {
        let messages = self.messages(row)?;
        let parts = match row.layout {
            Layout::V2 => inline_parts(&messages),
            Layout::Legacy => self.legacy_parts(&row.id)?,
        };
        Ok(Activity { messages, parts })
    }

    pub fn todo_statuses(&self, session: &str) -> anyhow::Result<Vec<String>> {
        if !has_table(&self.conn, "todo") {
            return Ok(Vec::new());
        }
        let mut stmt = self.conn.prepare("SELECT status FROM todo WHERE session_id = ?1 ORDER BY position")?;
        let rows = stmt.query_map([session], |r| r.get::<_, String>(0))?;
        Ok(rows.flatten().collect())
    }

    fn messages(&self, row: &SessionRow) -> anyhow::Result<Vec<Value>> {
        let mut stmt = self.conn.prepare(row.layout.messages_sql())?;
        let rows = stmt.query_map(rusqlite::params![row.id, MESSAGE_LOOKBACK], |r| {
            Ok((r.get::<_, Option<String>>(0)?, r.get::<_, String>(1)?))
        })?;
        Ok(rows.flatten().filter_map(|(role, data)| normalize_message(role, &data)).collect())
    }

    fn legacy_parts(&self, session: &str) -> anyhow::Result<Vec<Value>> {
        let sql = "SELECT data FROM part WHERE session_id = ?1 ORDER BY time_created DESC, id DESC LIMIT ?2";
        let mut stmt = self.conn.prepare(sql)?;
        let rows = stmt.query_map(rusqlite::params![session, PART_LOOKBACK], |r| r.get::<_, String>(0))?;
        Ok(rows.flatten().filter_map(|d| serde_json::from_str(&d).ok()).collect())
    }

    fn sessions(&self, layout: Layout, sql: &str, params: impl rusqlite::Params) -> anyhow::Result<Vec<SessionRow>> {
        let mut stmt = self.conn.prepare(sql)?;
        let rows = stmt.query_map(params, |r| session_row(r, layout))?;
        Ok(rows.flatten().collect())
    }
}

fn select_columns(conn: &Connection, table: &str) -> String {
    let col = |name: &str, fallback: &str| column_or(conn, table, name, fallback);
    format!(
        "id, directory, {}, {}, {}, {}, {}, {}, {}, time_created, time_updated",
        col("title", "''"),
        col("model", "NULL"),
        col("agent", "NULL"),
        col("tokens_input", "0"),
        col("tokens_output", "0"),
        col("tokens_cache_read", "0"),
        col("tokens_cache_write", "0"),
    )
}

fn session_row(r: &Row, layout: Layout) -> rusqlite::Result<SessionRow> {
    let n = |i: usize| r.get::<_, Option<i64>>(i).map(|v| v.unwrap_or(0).max(0) as u64);
    Ok(SessionRow {
        id: r.get(0)?,
        layout,
        directory: PathBuf::from(r.get::<_, String>(1)?),
        title: r.get::<_, Option<String>>(2)?.unwrap_or_default(),
        model: r.get(3)?,
        agent: r.get(4)?,
        tokens: TokenUsage::new(n(5)?, n(6)?, n(7)?, n(8)?),
        time_created: r.get(9)?,
        time_updated: r.get(10)?,
    })
}
