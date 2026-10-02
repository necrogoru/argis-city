use anyhow::Context;
use rusqlite::{Connection, OpenFlags};
use std::path::Path;
use std::time::Duration;

/// Opens a SQLite database strictly read-only (the owning tool keeps writing
/// it, often in WAL mode), with a short busy timeout.
pub fn open_read_only(path: &Path) -> anyhow::Result<Connection> {
    let flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX;
    let conn = Connection::open_with_flags(path, flags).with_context(|| format!("opening {}", path.display()))?;
    conn.busy_timeout(Duration::from_millis(1500))?;
    Ok(conn)
}

/// Whether `table` has `column` (schemas evolve between tool versions).
pub fn has_column(conn: &Connection, table: &str, column: &str) -> bool {
    let sql = format!("SELECT 1 FROM pragma_table_info('{table}') WHERE name = ?1");
    conn.query_row(&sql, [column], |_| Ok(())).is_ok()
}

/// Whether `table` exists.
pub fn has_table(conn: &Connection, table: &str) -> bool {
    let sql = "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1";
    conn.query_row(sql, [table], |_| Ok(())).is_ok()
}

/// `column` if it exists, else `fallback` — for building tolerant SELECTs.
pub fn column_or(conn: &Connection, table: &str, column: &str, fallback: &str) -> String {
    if has_column(conn, table, column) {
        column.to_string()
    } else {
        fallback.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_read_only_and_detects_columns() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("db.sqlite");
        Connection::open(&path).unwrap().execute_batch("CREATE TABLE t (a TEXT);").unwrap();
        let conn = open_read_only(&path).unwrap();
        assert!(has_column(&conn, "t", "a"));
        assert!(!has_column(&conn, "t", "b"));
        assert!(has_table(&conn, "t") && !has_table(&conn, "nope"));
        assert_eq!(column_or(&conn, "t", "b", "NULL"), "NULL");
        assert!(conn.execute("INSERT INTO t VALUES ('x')", []).is_err());
    }
}
