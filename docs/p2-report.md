# P2–P4 Local Core — Completion Report

Date: 2026-10-14. Source of truth: `DESKPET_PRD.md`.

## Yang berubah dari P1 (jawaban atas keluhan user)

1. **Opsi permanen dihapus.** Bar tombol Hide/Top/Motion/Zzz di bawah pet sudah dibuang.
   Penggantinya: **menu konteks klik kanan** (`PetContextMenu.tsx`) berisi semua aksi.
2. **Pet sekarang interaktif + bisa jalan.** Klik kiri = sapa (`react`), drag kiri pakai
   threshold 5px (tidak bocor ke klik belakang), dobel-klik = buka Asisten,
   **jalan otomatis** tiap 5–11 detik (`useWander.ts`: state `walk` + pindah window
   native, sprite flip arah; fallback geser CSS di web-preview). Jeda otomatis saat
   menu/panel terbuka, di-drag, tidur, atau reduced-motion.

## Cakupan PRD yang diimplementasikan (local-first, tanpa cloud)

- §5.1: drag/click/kanan/walk/hide-show/shortcut/tray/reduced-motion/always-on-top ✅
- §5.2: reminder CRUD, recurrence (none/daily/weekdays/weekly), snooze, quiet hours,
  scheduler tick 5 dtk (DB=source of truth ala localStorage), missed-handling, dedup via
  `lastTriggeredAt`, fallback toast saat izin notifikasi ditolak ✅
- §5.3: todos CRUD + filter + cari + link due ✅ (trash/undo: hapus langsung + toast)
- §5.4: notes CRUD + autosave 600ms + status simpan + cari + soft-delete ✅, export/import ✅
- §5.5: TTS speechSynthesis (antre, suara id优先, uji/stop/mute) ✅
- §5.6: parser NL deterministik ID+EN (reminder/todo/note/timer/query/kalender, intent
  email ditolak-eksekusi) + penanda processedLocally ✅
- §5.7: action registry + permission engine + validasi di **Rust** (`action_validate`,
  allowlist, tolak `shell.exec`) + audit metadata (`audit_log`, panel Settings) ✅
- §5.9–5.10: kalender **lokal** penuh; Google/Gmail sebagai **stub opt-in terputus**
  (disclosure jelas, tanpa OAuth diam-diam) ✅ parsial jujur
- §5.11: 3 otomatisasi bawaan (ringkasan pagi weekday, bacakan pengingat, review Jumat)
  + toggle + lastRun ✅ terbatas
- §6: panel tab (asisten/pengingat/tugas/catatan/timer/kalender/auto/settings), jendela
  membesar 400×620 saat panel terbuka ✅
- §8: migrasi `002_actions.sql` (audit/jobs/integrations/calendar_events/automations) ✅

## Tests run + results

- `npm test` (vitest): **30 passed, 0 failed** (state machine 4, PetCanvas 4, storage 1,
  time 11, parser 7, store 3).
- `cargo test`: **18 passed, 0 failed** (pet 5, settings 3, db 4, actions 6).
- `npx tsc --noEmit`: exit 0. `npm run build` (vite): success (44 modules).

## Yang SENGAJA belum (sesuai PRD non-goals / butuh keputusan)

1. OAuth Google/Gmail asli (butuh client-id, verifikasi provider, token di OS keychain).
2. Plugin dinamis pihak-3 (per PRD §5.8: butuh sandbox dulu).
3. Rust repository penuh untuk reminders/todos (saat ini sumber utama = localStorage
   frontend; SQLite siap via migrasi 001+002; sinkronisasi dua arah belum).
4. `tauri build` (msi/nsis/dmg) tetap harus dijalankan di tiap OS target + smoke
   multi-monitor/DPI/sleep-wake manual (lihat `docs/testing.md`).
5. Ikon tray/bundle masih placeholder 1-warna; `icon.icns` macOS belum ada.
