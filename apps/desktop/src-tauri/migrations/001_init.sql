-- P1 foundation schema (PRD §8 subset). Idempotent: safe to re-run.
-- Timestamps are UTC ISO-8601 TEXT. Timezone stored separately for recurrence.

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT,
    due_at TEXT NOT NULL,
    timezone TEXT NOT NULL,
    recurrence_rule TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','dismissed','snoozed')),
    snooze_until TEXT,
    last_triggered_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed')),
    priority INTEGER NOT NULL DEFAULT 0,
    due_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(status, due_at);
CREATE INDEX IF NOT EXISTS idx_todos_status_due ON todos(status, due_at);
CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(deleted_at);

INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
