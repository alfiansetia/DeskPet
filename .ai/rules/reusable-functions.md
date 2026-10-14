# Reusable Function Rules — DeskPet

Source of truth: PRD §7 (Rust authoritative), §8 (DB), §9 (privacy).

## Authority

- **Rust is authoritative** for persistence, validation, permissions, actions. Frontend mirrors (e.g. `petStateMachine.ts`) must state this in header and never bypass `invoke`.
- Frontend never touches SQLite or secrets. All data flows via `tauri::command`.

## Rust conventions (`apps/desktop/src-tauri/src/`)

1. **Modules:** `pet/` (state machine), `db/` (rusqlite + migrations), `settings/` (privacy defaults), `commands/` (Tauri invoke surface). New domains get a new module + `mod.rs` + unit tests.
2. **Errors:** `thiserror` enums, `Result<_, String>` at command boundary (serializable). Never log note bodies/prompts/secrets.
3. **DB:** `open_and_migrate(path)` + `open_in_memory()` for tests. Migrations live in `migrations/*.sql`, must be idempotent (`IF NOT EXISTS`). Timestamps UTC TEXT, timezone separate.
4. **Validation:** reject unknown actions/states; `PetState::from_str` errors on unknown; `AppSettings::validate()` forces `telemetry_enabled=false` in P1.
5. **Tests:** `cargo test` — every module has `#[cfg(test)]` covering happy path + rejection path.

## TypeScript conventions (`apps/desktop/src/lib/`, `features/`)

1. **State enums:** union type + `PET_STATES` array + `isValid*` guard + `canTransitionTo` mirror. Header must say "Rust is authoritative".
2. **Storage:** use `lib/storage.ts` `loadJSON/saveJSON` (try/catch, fallback) — never throw on quota/privacy mode.
3. **IPC:** wrap `invoke` in try/catch with offline fallback (`web-preview` badge). Never hard-fail the pet window if Rust is unreachable.
4. **Tests:** `*.test.ts(x)` colocated, run with `npm test` (vitest+jsdom).

## Privacy guards (all code)

- No telemetry, no keylogging/screenshots/clipboard, no network requirement for core.
- Sensitive actions (external writes, shell) do not exist in P1; any future one needs explicit `confirmation_required` + preview UI.
