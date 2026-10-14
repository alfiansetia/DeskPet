# DeskPet Architecture — P1 Foundation

Source: `DESKPET_PRD.md` §§5.1, 7, 8, 11.

## Stack (P1)

- Rust + Tauri 2 (OS integration, windows, tray, commands)
- React + TypeScript + Vite (pet window UI)
- SQLite via `rusqlite` (bundled) in Rust only
- Tests: `cargo test` (Rust), `vitest` (frontend)

## Flow

```text
React (apps/desktop/src) --invoke/events--> Rust core (src-tauri/src)
  pet/state.rs ──▶ commands ──▶ tray/window
  settings ──▶ commands
  db/open_and_migrate ──▶ SQLite file (app_local_data_dir/deskpet.db)
```

Rust is authoritative for state validation, settings guards, persistence.

## Modules

| Path | Responsibility |
|---|---|
| `src-tauri/src/pet/` | `PetState` enum (8 PRD states), `can_transition_to`, `FromStr` |
| `src-tauri/src/db/` | `open_and_migrate`, `open_in_memory`, migration runner |
| `src-tauri/src/settings/` | `AppSettings` defaults (`telemetry_enabled=false` enforced) |
| `src-tauri/src/commands/` | `pet_get/set_state`, `pet_is/are_visible`, `settings_get/update`, `app_health` |
| `src-tauri/src/lib.rs` | tray menu (Show/Hide/Top/Quit), left-click toggle, close→hide, DB best-effort init |
| `src/features/pet/` | TS mirror state machine + frame table (animation only) |
| `src/components/PetCanvas/` | CSS placeholder cat, reduced-motion aware |
| `src/lib/storage.ts` | safe localStorage helper |

## Window (tauri.conf.json)

- Label `pet`, 220×220, `transparent:true`, `decorations:false`, `alwaysOnTop:true`, `skipTaskbar:true`, `resizable:false`.
- Capabilities (`capabilities/default.json`): minimal window show/hide/drag/position + tray update.

## What P1 deliberately omits

AI, OAuth, email/calendar, dynamic plugin loading, scheduler daemon, notifications, TTS. No shell execution exists anywhere.
