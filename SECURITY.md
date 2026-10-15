# Security Policy

## Dukungan versi

| Versi | Didukung |
| ----- | -------- |
| 0.1.x (latest) | ✅ |
| < 0.1 | ❌ (pre-release, upgrade ke rilis terbaru) |

## Melaporkan kerentanan

**Jangan** laporkan celah keamanan lewat issue publik.

Kirim laporan ke pemilik repo via
[private vulnerability report](https://github.com/alfiansetia/DeskPet/security/advisories/new)
(GitHub → Security → Report a vulnerability), atau hubungi maintainer lewat
profil GitHub [@alfiansetia](https://github.com/alfiansetia).

Sertakan sebisa mungkin:

1. Deskripsi + dampak (apa yang bisa dilakukan penyerang?).
2. Langkah reproduksi / PoC minimal.
3. Versi DeskPet + OS yang terpengaruh.
4. Saran perbaikan bila ada.

Kami akan:

- Mengonfirmasi penerimaan laporan sesegera mungkin.
- Menahan detail publik sampai perbaikan + rilis tersedia.
- Mencatat perbaikan di `CHANGELOG.md` setelah rilis.

## Batasan keamanan yang sudah ditegakkan

- Validasi aksi di Rust (`action_validate`, allowlist; `shell.exec` ditolak).
- AI/parser hanya menghasilkan *structured action request* — tidak ada akses
  langsung ke SQLite, kredensial, atau OS API.
- Tulis eksternal (kalender/email/ntfy) butuh preview + konfirmasi eksplisit.
- Token tidak disimpan sebagai plaintext di SQLite.
- Log hanya berisi metadata, tanpa isi privat (lihat `docs/privacy.md`).
- Tanpa telemetri; tanpa screenshot/keylogging/clipboard monitoring.

## Yang belum dijamin (jujur, sesuai PRD)

- Alarm tidak dijamin bunyi saat komputer mati (native OS scheduling = P5).
- Installer rilis publik butuh code-signing/notarization (lihat
  `docs/build-windows-macos.md`) — jangan anggap binary tak bertanda sama
  tepercayanya dengan rilis bertanda.
