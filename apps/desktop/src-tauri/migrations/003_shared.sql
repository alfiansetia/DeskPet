-- 003 shared-db: single DB untuk semua window (multi-pet opsi B).
-- Data produktivitas (reminders/todos/notes/events/jobs) tetap GLOBAL, bukan
-- milik satu companion. Kolom `created_by` hanya info display ("dibuat dari
-- window X"), TIDAK PERNAH dipakai sebagai filter kepemilikan / partisi.
-- Per-companion yang disimpan terpisah: species/palette/scale/role/showTemp/
-- showMini (frontend `deskpet:companions`) + ephemeral animation state
-- (Rust `PetRegistry`). Idempotent: aman di-run ulang.
-- Scheduler/notifikasi tetap single-executor (hanya primary yang fire);
-- window lain hanya display + routing presenter via role.

ALTER TABLE reminders ADD COLUMN created_by TEXT;
ALTER TABLE todos ADD COLUMN created_by TEXT;
ALTER TABLE notes ADD COLUMN created_by TEXT;
ALTER TABLE calendar_events ADD COLUMN created_by TEXT;
ALTER TABLE scheduled_jobs ADD COLUMN created_by TEXT;

INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (3, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
