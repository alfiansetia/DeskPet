-- P2–P4 schema additions (PRD §8 full tables). Idempotent.
-- Keeps P1 tables; adds audit, jobs, integrations, local calendar events, automations.

CREATE TABLE IF NOT EXISTS action_audit (
    id TEXT PRIMARY KEY,
    action_id TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'executed' CHECK (status IN ('executed','previewed','rejected','confirmed')),
    confirmation_required INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id TEXT PRIMARY KEY,
    action_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    run_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed','cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    account_label TEXT,
    permissions_json TEXT NOT NULL DEFAULT '[]',
    connected_at TEXT NOT NULL,
    revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    location TEXT,
    source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('local','google')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trigger TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todos_trash (
    id TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    deleted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON action_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_run ON scheduled_jobs(status, run_at);
CREATE INDEX IF NOT EXISTS idx_events_start ON calendar_events(start_at);
CREATE INDEX IF NOT EXISTS idx_auto_trigger ON automations(trigger, enabled);

INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (2, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
