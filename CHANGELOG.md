# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/)
dan [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-10-15

Rilis awal publik (fondasi P1 + inti lokal P2–P4).

### Ditambahkan

- Karakter desktop interaktif (Tauri 2, window transparan always-on-top):
  5 spesies (kucing, ular, kodok, burung hantu, penguin), palet recolorable,
  drag dengan threshold, klik = sapa, tahan = elus, dobel-klik = asisten,
  klik kanan = menu konteks, jalan otomatis (wander), mode pemalu, topi
  unlockable, stat Tamagotchi-lite (kenyang/mood/energi).
- Multi-kawan (1 window per companion, maks 5): role presenter alert
  (`all/reminder/prayer/timer/decor`), scheduler terpusat anti-duplikat,
  live-sync data antar-window, restore window saat restart.
- Panel 13 tab: Asisten, Pengingat, Tugas, Catatan, Timer, Kalender (lokal),
  Jadwal sholat, Otomatisasi, ntfy/API-watch, Kawan, Pengaturan, Tentang, Log.
- Pengingat: CRUD, recurrence (none/daily/weekdays/weekly), snooze,
  quiet-hours, scheduler tick 5 dtk, missed-handling, dedup `lastTriggeredAt`.
- Tugas + catatan: CRUD, filter/cari, autosave 600 ms, soft-delete, export/import.
- Timer fokus terpusat multi-window (countdown shared, eksekusi hanya primary).
- Parser NL deterministik ID+EN (pengingat/todo/catatan/timer/query/kalender/
  tunda/hapus/selesai/cari/ntfy; email = tolak-eksekusi) + validasi Rust
  (`action_validate`, allowlist, audit metadata).
- Jadwal sholat cache-first (MyQuran/Kemenag → fallback Aladhan method 20
  Kemenag RI, tanpa API key) + cuaca Open-Meteo (tanpa API key) + pill ambient
  rotasi + reaksi hujan.
- ntfy/API-watch opt-in (SSE topic, simpan-sebagai-pengingat opsional,
  TTS opsional).
- TTS antrean (speechSynthesis), suara efeks WebAudio offline, mute terpisah.
- Backup/restore JSON eksplisit (versi 2, termasuk companions + api-config).
- Autostart (login items), tray menu, shortcut `Ctrl/Cmd+Shift+D`, Esc
  konfirmasi alert, file log lokal (`log_path`/`log_read`/`log_clear`).
- SQLite lokal (`deskpet.db`, migrasi 001–003) + update checker (`updates/stable.json`).
- Test: Vitest frontend + `cargo test` backend + typecheck `tsc --noEmit`.

### Disengaja belum (non-goals / butuh keputusan)

- OAuth Google Calendar/Gmail asli (stub opt-in terputus; butuh client-id,
  verifikasi provider, token di OS keychain).
- Plugin dinamis pihak-3 (butuh sandbox dulu, per PRD §5.8).
- Sinkronisasi cloud / akun (tidak direncanakan).
- Code-signing + notarization rilis publik (lihat `docs/build-windows-macos.md`).

[0.1.0]: https://github.com/alfiansetia/DeskPet/releases/tag/v0.1.0
