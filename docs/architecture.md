# Arsitektur DeskPet

Sumber: `DESKPET_PRD.md` §§5, 7, 8, 11. Status: P1 ✅ + inti lokal P2–P4 ✅.

## Tumpukan

| Lapisan | Teknologi | Tanggung jawab |
| --- | --- | --- |
| Desktop runtime | Rust + Tauri 2 | OS integration, windows, tray, lifecycle, commands |
| UI | React + TypeScript + Vite | Pet window, 13-tab panel, settings |
| Animasi | Spritesheets + Canvas/CSS | State pet + transisi (dengan fallback CSS) |
| Database | SQLite via `rusqlite` (bundled), hanya via Rust | Persistensi lokal (`deskpet.db`) |
| Mirror frontend | localStorage (`deskpet:*`) | Source of truth operasional harian + live-sync |
| Scheduler | Tick 5 dtk (primary saja) + DB | Occurrence pengingat, snooze, missed-handling |
| Notifikasi | Toast in-app + (native menyusul) | Fallback jelas bila izin ditolak |
| TTS/SFX | speechSynthesis + WebAudio | Antrean bicara + beep offline |
| Integrasi eksternal | MyQuran, Aladhan, Open-Meteo, ntfy (opt-in) | Fetch best-effort + cache-first |
| Test | `cargo test`, Vitest, `tsc --noEmit` | Unit + UI + validasi |

## Aliran

```text
React (apps/desktop/src) --invoke/events--> Rust core (src-tauri/src)
  pet/state.rs + companions/ (PetRegistry) --> commands --> tray/window
  settings/ (+ frontend_settings_* mirror) --> commands
  actions/ (action_validate + allowlist) + audit
  applog/ (log_path/read/clear/write, metadata saja)
  db/open_and_migrate --> SQLite (app_local_data_dir/deskpet.db)
  prayer_cache_get/put (mirror tahan lama jadwal)
         |
         v
SQLite + OS APIs + provider eksternal yang eksplisit diizinkan
```

**Aturan arsitektur (PRD §7):** Rust otoritatif untuk persistensi, validasi,
izin, eksekusi. React tidak menyentuh SQLite/kredensial langsung. Konten
eksternal + output AI/parser = untrusted. Fitur inti jalan tanpa network.

## Modul Rust (`src-tauri/src`)

| Path | Tanggung jawab |
| --- | --- |
| `pet/` | `PetState` (8 state PRD), `can_transition_to`, `FromStr` |
| `companions/` | `PetRegistry` per-id + validasi ID + mapping label |
| `commands/` | `pet_get/set_state[_of]`, `companions_spawn/despawn/list/owner_of`, `pet_is/are_visible`, `settings_get/update`, `frontend_settings_get/put`, `backup_export`, `log_*`, `prayer_cache_*`, `app_health`, `action_validate`, `audit_log`, `app_quit` |
| `actions/` | Registry + permission engine + allowlist (tolak `shell.exec`) |
| `applog/` | Log file lokal (metadata saja) |
| `db/` | `open_and_migrate`, migrasi 001–003, WAL |
| `settings/` | `AppSettings` defaults (`telemetry_enabled=false` enforced) |
| `lib.rs` | Tray (Show/Hide/Top/Quit), klik-kiri toggle, close→hide, DB best-effort init, autostart + opener plugin |

## Modul frontend (`apps/desktop/src`)

| Path | Tanggung jawab |
| --- | --- |
| `App.tsx` | Shell: interaksi pet, scheduler primary, prayer/weather/ntfy/timer effects, resize window, keyboard |
| `components/MainPanel.tsx` | 13 tab + `schedulerTick` murni (testable) |
| `components/PetCanvas/` | Renderer sprite/CSS + reduced-motion |
| `components/Bubble.tsx` | Slot ambient rotasi (±4 dtk) |
| `features/pet/` | State machine, `useWander`, `useIdleBehavior`, species/palettes/recolor/hats/greetings/care/companions, context menu |
| `features/assistant/` | Parser NL deterministik + `validateAction` (pre-check) |
| `features/prayer/` | MyQuran→Aladhan, cache harian, countdown, adzan beep |
| `features/weather/` | Open-Meteo tanpa key, cache 15 mnt |
| `features/apiwatch/` | ntfy SSE opt-in |
| `features/updater/` | Cek `updates/stable.json` |
| `features/startup/` | Sinkron autostart OS |
| `features/calendar/` | Acara lokal (+ stub Google terputus) |
| `lib/` | `store` (localStorage + backup v2), `time`, `notify` (toast), `tts`, `sfx`, `timerShared`, `sharedData` (live-sync), `settingsSync`, `appLog`, `taskNudge`, `petWindow`, `windowFit`, `useWindowHover` |

## Window (`tauri.conf.json`)

- Label `pet`, 170×200 awal (dipeluk ke sprite via `petWindowLogicalSize` +
  ukur DOM; panel 400×620; menu 400×560), `transparent:true`,
  `decorations:false`, `alwaysOnTop:true`, `skipTaskbar:true`,
  `resizable:true`, `shadow:false`, `acceptFirstMouse:true`.
- Capabilities minimal: show/hide/drag/position + tray update.
- CSP: `default-src 'self'`; `img-src` mengizinkan `data:`/`asset:`; `connect-src`
  mengizinkan `http(s):` (untuk MyQuran/Aladhan/Open-Meteo/ntfy opt-in).

## Multi-pet (1 window per companion, maks 5)

- Model `Companion` + store `deskpet:companions` + migrasi legacy + backup v2.
- Rust `PetRegistry`; command lama kompatibel (operasi `"main"`).
- **Scheduler terpusat:** hanya primary yang menjalankan tick pengingat,
  prayer, ringkasan pagi, care decay, fetch network, eksekusi timer selesai.
  Alert dirutekan via `resolvePresenterFor(list, kind)` by `role`
  (`decor` tidak pernah present) lewat `deskpet://present-alert`.
- **Pill ambient per-pet** dari cache shared (tanpa network; refresh 60 dtk);
  fase + jitter hash-id agar rotasi tidak sinkron.
- **Wander per-window** (`useWander` + `phaseDelayMsFor(id)`).
- **Restore:** window sekunder dibuka ulang primary saat boot (sekuensial,
  idempoten, timeout 12 dtk/window).
- Batasan v1: stat + topi + elusan masih global (shared).

## Single shared DB

- Satu kebenaran: `deskpet.db` (WAL) + mirror localStorage
  (`deskpet:reminders/todos/notes/events/automations`, `deskpet:timer`).
- `createdBy` hanya display (migrasi `003_shared.sql`); bukan filter.
- Per-companion hanya: species/palette/scale/role/showTemp/showMini/shy/
  gaya jalan + ephemeral animation state.
- Live-sync: `store.*.save()` → `notifyDataChanged(kind)` → `CustomEvent` +
  `storage` event + `deskpet://data-changed`; panel subscribe.
- Single-executor: countdown/badge dilukis semua window dari state shared.

## Migrasi SQLite

- `001_init.sql`: reminders/todos/notes/app_settings + indexes.
- `002_actions.sql`: audit/jobs/integrations/calendar_events/automations.
- `003_shared.sql`: kolom nullable `created_by` (info display).
- Aturan: timestamp absolut UTC + timezone IANA terpisah; transaksi untuk
  multi-tabel; index untuk due/status; tanpa secret plaintext; backup eksplisit;
  uji migrasi dari versi lama.

## Yang disengaja belum

AI eksternal, OAuth Google/Gmail asli, plugin dinamis pihak-3, scheduler OS
native (alarm saat mati), signing/notarization rilis (P5). Lihat PRD §§10, 19.
