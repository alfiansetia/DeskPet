//! SQLite setup + P1 migrations. DB is source of truth (PRD §5.2, §8).
//! Only foundation tables are created in P1; later milestones add indexes
//! and migrations on top of `schema_version`.

use rusqlite::Connection;
use std::path::Path;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

/// P1 initial schema + P2–P4 additions (PRD §8 full). Idempotent, ordered.
pub const MIGRATION_001: &str = include_str!("../../migrations/001_init.sql");
pub const MIGRATION_002: &str = include_str!("../../migrations/002_actions.sql");
/// 003: info-only `created_by` columns (single shared DB, multi-window).
/// NOTE: contains ALTER TABLE ... ADD COLUMN which is NOT re-runnable via
/// execute_batch — use `apply_migration_003` which ignores duplicate-column.
pub const MIGRATION_003: &str = include_str!("../../migrations/003_shared.sql");

/// Apply 003 statement-by-statement; `duplicate column name` is OK (re-run).
fn apply_migration_003(conn: &Connection) -> Result<(), DbError> {
    for stmt in MIGRATION_003.split(';') {
        let s = stmt.trim();
        if s.is_empty() || s.starts_with("--") && !s.contains("ALTER") && !s.contains("INSERT") {
            // Skip pure-comment chunks; keep statements that embed comments.
            if !s.to_uppercase().contains("ALTER") && !s.to_uppercase().contains("INSERT") {
                continue;
            }
        }
        if s.is_empty() {
            continue;
        }
        if let Err(e) = conn.execute_batch(s) {
            let msg = e.to_string();
            if msg.contains("duplicate column name") {
                continue; // idempotent re-run
            }
            return Err(DbError::Sqlite(e));
        }
    }
    Ok(())
}

/// Open (creating parent dirs) and migrate a SQLite file.
pub fn open_and_migrate(path: &Path) -> Result<Connection, DbError> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }
    let conn = Connection::open(path)?;
    // Privacy: no sensitive content in logs; keep pragmas conservative.
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    conn.execute_batch(MIGRATION_001)?;
    conn.execute_batch(MIGRATION_002)?;
    apply_migration_003(&conn)?;
    Ok(conn)
}

/// In-memory DB for tests.
pub fn open_in_memory() -> Result<Connection, DbError> {
    let conn = Connection::open_in_memory()?;
    conn.execute_batch(MIGRATION_001)?;
    conn.execute_batch(MIGRATION_002)?;
    apply_migration_003(&conn)?;
    Ok(conn)
}

/// Default DB path: OS-local app data dir, never synced.
pub fn default_db_path(app_data_dir: &Path) -> std::path::PathBuf {
    app_data_dir.join("deskpet.db")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_creates_foundation_tables() {
        let conn = open_in_memory().expect("in-memory open");
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap();
        let tables: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        for expected in ["reminders", "todos", "notes", "app_settings", "action_audit", "scheduled_jobs", "integrations", "calendar_events", "automations"] {
            assert!(tables.contains(&expected.to_string()), "missing {expected}: {tables:?}");
        }
    }

    #[test]
    fn migration_is_idempotent() {
        let conn = open_in_memory().unwrap();
        conn.execute_batch(MIGRATION_001).expect("re-run must succeed");
        conn.execute_batch(MIGRATION_002).expect("re-run must succeed");
        apply_migration_003(&conn).expect("003 re-run must succeed");
        apply_migration_003(&conn).expect("003 double re-run must succeed");
    }

    #[test]
    fn shared_db_has_info_only_created_by() {
        // Single shared DB: created_by ada di semua tabel produktivitas,
        // nullable, tidak ada filter kepemilikan (tanpa FK / tanpa index parsial).
        let conn = open_in_memory().unwrap();
        for table in ["reminders", "todos", "notes", "calendar_events", "scheduled_jobs"] {
            let cols: Vec<String> = conn
                .prepare(&format!("PRAGMA table_info({table})"))
                .unwrap()
                .query_map([], |row| row.get::<_, String>(1))
                .unwrap()
                .map(|r| r.unwrap())
                .collect();
            assert!(cols.contains(&"created_by".to_string()), "missing created_by in {table}: {cols:?}");
        }
        // created_by murni info: insert tanpa created_by tetap valid (global data).
        conn.execute(
            "INSERT INTO todos (id, title, status, priority, created_at, updated_at) VALUES ('t-shared','global task','open',0,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')",
            [],
        )
        .unwrap();
        let by: Option<String> = conn
            .query_row("SELECT created_by FROM todos WHERE id='t-shared'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(by, None);
    }

    #[test]
    fn file_db_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("deskpet.db");
        let conn = open_and_migrate(&path).expect("open");
        conn.execute(
            "INSERT INTO todos (id, title, status, priority, created_at, updated_at) VALUES ('t1','P1 smoke', 'open', 0, '2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')",
            [],
        )
        .unwrap();
        drop(conn);
        let conn2 = open_and_migrate(&path).unwrap();
        let count: i64 = conn2
            .query_row("SELECT COUNT(*) FROM todos WHERE id='t1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn rejects_invalid_status_via_check() {
        let conn = open_in_memory().unwrap();
        let res = conn.execute(
            "INSERT INTO todos (id, title, status, priority, created_at, updated_at) VALUES ('x','bad','nonsense',0,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')",
            [],
        );
        assert!(res.is_err(), "CHECK constraint should reject bad status");
    }
}
