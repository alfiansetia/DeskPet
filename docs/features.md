# Fitur DeskPet (manual lengkap)

> Status implementasi: fondasi P1 ✅ + inti lokal P2–P4 ✅.
> Google Calendar/Gmail = **stub opt-in terputus** (belum OAuth).
> Plugin dinamis = ditunda per PRD §5.8.

## 1. Karakter desktop

- **Spesies:** kucing 🐱, ular 🐍, kodok 🐸, burung hantu 🦉, penguin 🐧
  (`apps/desktop/src/features/pet/species.ts`, aset di
  `assets/characters/<spesies>/`: spritesheets + SVG master + `manifest.json`).
- **Warna recolorable:** lavender, sky, matcha, peach, rose, midnight, custom
  hex (`palettes.ts`, `recolor.ts`). Berlaku lintas spesies.
- **State machine (8 state PRD):** `idle`, `walk`, `dragged`, `react`,
  `sleep`, `speak`, `reminder`, `attention` (+ `jump` sebagai varian play).
  Transisi divalidasi di TS (`petStateMachine.ts`) dan Rust
  (`src-tauri/src/pet/state.rs`).
- **Interaksi:**
  - Drag kiri (threshold 5 px, `startDragging()` native; lepas = kembali
    `idle` via `window mouseup/blur`).
  - Klik = `react` + bubble sapaan acak (konteks hujan/lapar).
  - Tahan ≥ 500 ms = elus (hati + bunyi + hitungan; unlock topi 🧢/🥳/👑 di
    0/5/15 elusan; elus beruntun tidak salah jadi double-click).
  - Dobel-klik = buka panel Asisten. Hover = menoleh ke kursor.
  - Klik kanan = menu konteks (tanpa bar opsi permanen).
- **Jalan otomatis (wander):** tiap 5–11 dtk ke arah acak
  (`useWander.ts`, state `walk` + pindah window native + sprite flip).
  Kecepatan: acak/pelan/normal/lari. Arah: acak/horizontal/vertikal/pinggir.
  Jeda otomatis saat menu/panel terbuka, di-drag, tidur, hover, alert,
  mood rendah, atau reduced-motion. Web-preview = geser CSS.
- **Mode pemalu:** kabur saat hover (pakai posisi pinggir/arah menjauh;
  cooldown anti-spam; jinak sementara dengan tahan `Shift`).
- **Tamagotchi-lite:** lapar/mood/energi meluruh per jam (tidur memulihkan
  energi). Peringatan sekali saat melewati ambang. Kasih makan / ajak main
  via menu / Pengaturan. Mood jelek → mager (berhenti jalan).
- **Fokus alert:** pengingat/timer/waktu sholat/ringkasan pagi/ntfy → pet kembali
  ke tengah layar + membesar sampai dikonfirmasi (klik pet/bubble/toast/Esc).
  Bisa dimatikan (`centerOnAlert`). Lama nempel diatur via
  `alertDurationSec` (`0` = sampai diklik, default; atau 60/300/1800/3600 dtk).
  Info H-X sholat tidak memindahkan pet.
- **Ukuran pet:** 50–200% via menu (🔍＋/🔍－/↩) atau slider; sprite +
  placeholder ikut skala; arah hadap tetap benar; window Tauri menyesuaikan.
- **Sembunyi/tampil:** menu → 🙈, tray Show/Hide, atau
  `Ctrl+Shift+D` (Windows) / `Cmd+Shift+D` (macOS).

## 2. Panel (13 tab)

Window membesar 400×620 saat panel terbuka; menu konteks butuh 400×560.

| Tab | Isi |
| --- | --- |
| Asisten | Input NL (ID/EN) + preview aksi + konfirmasi bila perlu |
| Pengingat | CRUD, recurrence, snooze, quiet-hours, missed-handling |
| Tugas | CRUD + prioritas + due date + filter/status/cari + link pengingat |
| Catatan | CRUD + autosave 600 ms + status simpan + cari + soft-delete + export/import |
| Timer | Fokus 5/15/25 mnt atau custom; countdown shared multi-window |
| Kalender | Acara **lokal** penuh; Google = stub opt-in terputus |
| Jadwal sholat (🌙) | Kota bersama cuaca; countdown + kartu detail; adzan beep + TTS opsional |
| Otomatisasi | 4 bawaan: ringkasan pagi, bacakan pengingat, review Jumat, nudge tugas |
| ntfy / API-watch | Subscribe SSE topic ntfy (opt-in); simpan-sebagai-pengingat; TTS |
| Kawan | Tambah/hapus companion (maks 5), spesies/warna/role/ukuran/pill/shy |
| Pengaturan | Karakter, suara, notifikasi, privasi, AI-off, startup, backup, topi |
| Tentang | Versi app, info build, tautan repo/rilis |
| Log | Audit aksi + akses eksternal (metadata saja) + file log lokal |

## 3. Pengingat (§5.2)

- Field: judul, body opsional, `dueAt` (UTC absolut), timezone IANA,
  recurrence (`none/daily/weekdays/weekly`), status
  (`active/completed/dismissed/snoozed`), `snoozeUntil`, `lastTriggeredAt`.
- Scheduler tick 5 dtk (DB/localStorage = source of truth, bukan timer
  frontend semata). Dedup via `lastTriggeredAt`. Missed-handling setelah
  sleep/restart. Snooze = due baru tanpa menghapus definisi asli.
- Bubble alert nempel mengikuti `alertDurationSec` (`App.tsx:alertTimeoutMs`):
  `0` = persistent sampai dikonfirmasi; selain itu auto-close
  60/300/1800/3600 dtk. Satu setting untuk pengingat, sholat, timer, ntfy.
- Quiet-hours (default 22–07, bisa diubah/dimatikan).
- Fallback toast jelas bila izin notifikasi OS ditolak.

## 4. Tugas, catatan, kalender lokal

- **Tugas:** status `open/in_progress/completed`, prioritas, due date,
  deskripsi, label; filter status/prioritas/due; cari; hapus langsung + toast
  (tanpa trash terpisah).
- **Catatan:** autosave + indikator simpan; soft-delete + restore;
  export/import eksplisit via aksi user. Isi tidak pernah masuk log.
- **Kalender lokal:** tambah/lihat acara (judul, mulai, selesai, lokasi);
  sumber `local`. Google = stub: tampil status terputus + disclosure,
  tanpa OAuth diam-diam.

## 5. Asisten + action registry (§5.6–5.7)

- Parser deterministik lokal, tanpa network/AI (`parser.ts`, ID + EN).
  Lihat cheat sheet: [`docs/assistant-parser.md`](./assistant-parser.md).
- Setiap hasil parse = `ParsedAction`: `action` + `preview` + `permission`
  + `needsConfirm` + `processedLocally: true`.
- Validasi otoritatif di Rust (`action_validate`): allowlist, tolak
  `shell.exec` dan payload malformed. Frontend `validateAction` hanya
  pre-check.
- Kebijakan default (PRD §5.7): baca-lokal langsung; tulis-lokal ikut
  setting + undo/toast; terjadwal validasi + konfirmasi bila ambigu;
  baca-eksternal butuh provider tersambung + scope; tulis-eksternal preview
  + konfirmasi; high-risk (kirim email, hapus eksternal, shell) = konfirmasi
  eksplisit / belum tersedia.
- Audit: `deskpet:audit` (maks 200 entri, metadata saja) + tab Log.

## 6. Jadwal sholat + cuaca (pill ambient)

- **Sumber:** MyQuran v2 (Kemenag, tanpa API key) → fallback Aladhan
  (method=20 Kemenag RI). Daftar kota: `fetchCities()` (cache) atau
  `POPULAR_CITIES` (14 kota) saat offline.
- **Cache-first:** jadwal hari ini tersimpan (localStorage + file tahan lama
  Rust `prayer_cache_*`); pill countdown langsung tampil saat boot tanpa
  network; label "offline" bila basi.
- **Alert:** 5 waktu wajib (Subuh, Dzuhur, Ashar, Maghrib, Isya) — toleransi
  0–90 dtk, dedup per hari; pengingat H-X menit (default 10, 0–30) bunyi
  sekali per 5 mnt agar tidak spam; adzan = beep WebAudio offline + TTS
  opsional (hormati quiet-hours).
- **Cuaca:** Open-Meteo tanpa API key (suhu + kondisi, cache 15 mnt, refresh
  10 mnt). Reaksi hujan → toast sekali per transisi.
- **Pill:** suhu + countdown sholat berbagi satu slot di atas pet
  (`Bubble`, rotasi tiap ±4 dtk, bisa dimatikan terpisah). Klik/dielus =
  sapaan menyela slot sementara. Per-companion: fase + jitter hash-id agar
  tidak sinkron.

## 7. Multi-kawan (1 window per companion, maks 5)

- Model `Companion { id, name, species, paletteId, customColor, scale, role,
  wanderEnabled, wanderPace, wanderDirection, showTemp, showMini, shy }`.
  `id "main"` = window `pet`; sekunder `c_*` = window `pet-<id>`.
- Store `deskpet:companions` + migrasi otomatis dari settings single-pet lama;
  ikut backup/restore (versi 2).
- Rust `PetRegistry` per-id + commands `pet_get/set_state_of`,
  `companions_spawn` (cascade +60 px), `companions_despawn` (tolak `"main"`),
  `companions_list`. Command lama tetap kompatibel (operasi `"main"`).
- **Scheduler terpusat:** hanya primary yang menjalankan tick pengingat,
  prayer, ringkasan pagi, care decay, fetch network, eksekusi timer selesai.
  Alert dirutekan ke presenter via `resolvePresenterFor(list, kind)` by role
  (`decor` tidak pernah present) lewat event `deskpet://present-alert`.
- **Single shared DB:** semua window membaca daftar yang sama
  (`deskpet.db` + mirror localStorage). `createdBy` hanya info display,
  bukan filter kepemilikan. Live-sync via `notifyDataChanged(kind)`.
- Batasan v1: stat lapar/mood/energi + topi + elusan masih global (shared).

## 8. Timer, TTS, suara

- Timer terpusat: state di localStorage (`deskpet:timer`) sehingga semua
  window menampilkan countdown sama; hanya primary yang mengeksekusi selesai
  (guard `completedTimerEnd`). Opsi selesai-tanpa-alert tersedia.
- TTS: `speechSynthesis` antrean (suara id prioritas), uji/stop/mute;
  default **mati** (opt-in). Isi sensitif tidak dibacakan otomatis.
- SFX: beep WebAudio offline (tanpa file eksternal); mute suara dan mute
  bicara terpisah.

## 9. ntfy / API-watch (opt-in)

- Subscribe SSE ke server ntfy + topic pilihan user (default `ntfy.sh` bisa
  diganti self-host). Hanya primary yang subscribe (anti-duplikat).
- Pesan baru → alert (dirutekan by role) + audit `apiwatch.ntfy` + file log
  (metadata: topic + id saja). Opsi: simpan sebagai pengingat, bacakan via TTS.
- Kirim via asisten (`ntfy.send`) = network, selalu perlu konfirmasi.

## 10. Startup, tray, update, backup

- Autostart via `tauri-plugin-autostart` (diselaraskan dengan setting user).
- Tray: Show/Hide (semua window `pet*`), Toggle always-on-top, Quit.
  Klik kiri tray = toggle. Close window = hide (bukan quit).
- Update checker: `features/updater` membaca `updates/stable.json`.
- Backup/restore JSON eksplisit (`exportBackup`/`importBackup`, versi 2):
  reminders, todos, notes, events, automations, settings, companions,
  api-config. Validasi `app === "deskpet"`.
- File log lokal: `log_path` / `log_read` / `log_clear` / `log_write`
  (tab Log bisa baca/bersihkan; isi privat tidak dicatat).
