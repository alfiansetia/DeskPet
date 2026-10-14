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

## Multi-pet (opsi B: 1 window per companion)

- **Model:** `src/features/pet/companions.ts` — `Companion { id, name, species, paletteId, customColor, scale, role }`.
  `id "main"` = pet utama (window `pet`); sekunder `c_*` = window `pet-<id>`. Max 5.
- **Store:** `store.companions` (`deskpet:companions`, localStorage) + migrasi otomatis
  dari settings single-pet lama + ikut backup/restore (`version: 2`).
- **Rust:** `src-tauri/src/companions/` (`PetRegistry` per-id state + validasi ID +
  mapping label, mirror TS). Commands: `pet_get/set_state_of`, `companions_spawn`
  (cascade +60px, fokus bila sudah ada), `companions_despawn` (tolak `"main"`),
  `companions_list`. Command lama `pet_get/set_state` tetap kompatibel (operasi `"main"`).
  Tray Show/Hide + close→hide berlaku ke semua window `pet*`. Capability: `pet`, `pet-*`.
- **Scheduler terpusat:** hanya window primary yang menjalankan tick pengingat,
  prayer, ringkasan pagi, dan care decay (anti-duplikat). Alert dirutekan ke presenter
  via `resolvePresenterFor(list, kind)` berdasarkan `role` (`all/reminder/prayer/timer`;
  `decor` tidak pernah present), dikirim lewat event `deskpet://present-alert`.
  Timer per-window tetap lokal. Cuaca + fetch jadwal hanya primary.
- **Pill ambient per-pet:** tiap window melukis pill suhu/mini-sholat dari cache
  shared (tanpa network; refresh 60 dtk). Tampil tidaknya diatur per-companion
  (`showTemp`/`showMini`, default on, via Pengaturan → Kawan desktop); setting
  global (`weatherEnabled`, `tempBubbleEnabled`, `prayerEnabled`,
  `prayerMiniEnabled`) tetap berlaku sebagai master switch. Fetch network +
  toast hujan hanya primary.
- **Rotasi pill ngacak:** fase awal + periode rotasi (4 dtk + jitter 0–1,5 dtk)
  di-hash dari id companion (`slotPhaseFor`/`slotPeriodJitterMsFor`) agar pill
  tiap pet ganti tidak barengan dan tidak sinkron permanen.
- **Wander:** tiap window menggerakkan window-nya sendiri (`useWander` +
  `startDelayMs = phaseDelayMsFor(id)` agar tidak gerak sinkron).
- **Kelola:** Pengaturan → "Kawan desktop" (tambah spesies/warna/role, tampilkan,
  hapus). Web preview: daftar tersimpan, window baru hanya di build desktop.
- **Batasan v1:** stat lapar/mood/energi + topi + elusan masih global (shared),
  belum per-companion. localStorage diasumsikan shared antar-window (default Tauri).
