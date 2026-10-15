# Privasi — jaminan DeskPet (PRD §9)

> Prinsip: **local-first, privacy-first, permission-based.**
> Dokumen ini adalah janji yang bisa diverifikasi dari kode, bukan slogan.

## Jaminan inti

- **Local-first:** window pet, state machine, settings, SQLite, pengingat,
  tugas, catatan, timer, TTS antrean, parser NL — semuanya jalan **offline**.
  `app_health` melaporkan `networkRequired:false`, `telemetry:false`.
- **Tanpa telemetri:** tidak ada kode pelacakan/analytics. `AppSettings`
  `telemetry_enabled` default `false` dan validator **menolak** `true`.
- **Tanpa sadap:** tanpa screenshot, keylogging, clipboard monitoring, atau
  global input hook. Satu-satunya listener keyboard lokal: shortcut
  sembunyi/tampil (`Ctrl/Cmd+Shift+D`), `Esc`, dan tahan-`Shift` jinak.
- **Tanpa aksi sensitif diam-diam:** tidak ada tulis eksternal, shell, atau AI
  di P1–P4 lokal. Semua aksi lewat registry + permission engine; tulis
  eksternal (kalender/email/ntfy) wajib preview + konfirmasi eksplisit.
- **Rahasia:** tidak ada secret di P1. Aturan tetap: token **tidak** disimpan
  sebagai plaintext di SQLite — pakai OS credential storage (ditegakkan
  mulai integrasi P4/OAuth).
- **Log minimal:** Rust log hanya error init non-sensitif ke stderr
  (`[deskpet] ...`); audit (`audit_log`, tab Log) + file log hanya
  **metadata** (actionId, source, status, topic/id ntfy) — tanpa isi catatan,
  email, prompt, atau body privat. Isi catatan tidak pernah dikirim ke AI
  kecuali user eksplisit submit.

## Network yang ada (semuanya opt-out atau opt-in jelas)

| Akses | Kapan | Default | Bisa dimatikan |
| --- | --- | --- | --- |
| MyQuran → Aladhan (jadwal sholat) | Bila `prayerEnabled`, 1x/kota/hari + cache | on | Ya (`prayerEnabled`) |
| Open-Meteo (cuaca) | Bila `weatherEnabled`, cache 15 mnt | on | Ya (`weatherEnabled`) |
| ntfy SSE | Hanya bila user mengisi server+topic + mengaktifkan | **off** | Ya (matikan di tab ntfy) |
| `ntfy.send` dari asisten | Hanya via perintah eksplisit + konfirmasi | — | Selalu konfirmasi |
| Update checker (`updates/stable.json`) | Cek versi | on | Lihat Pengaturan |

Tanpa network + tanpa cache: fitur inti tetap jalan; pill sholat/cuaca
menampilkan label "offline" atau disembunyikan sesuai setting.

## Di mana datamu

- SQLite: `<app_local_data>/deskpet.db` (WAL) — pengingat/tugas/catatan/dll.
- localStorage keys `deskpet:*` (mirror operasional + settings + companions).
- File jadwal tahan lama: via `prayer_cache_put/get` (jadwal saja, bukan
  data privat). File log lokal: via `log_path` (bisa dibaca/dihapus user).
- Backup: hanya terjadi via aksi eksplisit user (Export). Tidak ada sync
  cloud, akun wajib, atau upload diam-diam.

## Verifikasi sendiri

```bash
cd apps/desktop
npm run test:rust   # settings menolak telemetry=true; actions menolak shell.exec
npm test            # parser + store + time
```

Cari di kode: `telemetry_enabled`, `action_validate`, `audit_log`,
`notifyDataChanged`, `log_write`, `connect-src` di `tauri.conf.json`.
