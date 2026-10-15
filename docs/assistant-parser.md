# Asisten NL — cheat sheet parser lokal

Parser deterministik, **tanpa network, tanpa AI**
(`apps/desktop/src/features/assistant/parser.ts`, ID + EN).
Setiap input menghasilkan `ParsedAction`:

```ts
{ action, preview, permission, needsConfirm, processedLocally: true }
```

Validasi otoritatif di Rust (`action_validate`). Batas panjang: judul ≤ 200
karakter, isi catatan ≤ 20.000, pesan ntfy ≤ 4.000, timer 1 dtk–12 jam.

## Tabel perintah

| Ucapkan (contoh) | Aksi | Izin | Konfirmasi |
| --- | --- | --- | --- |
| `ingatkan saya rapat besok jam 9 pagi` / `remind me to deploy at 4 pm` | `reminder.create` | `scheduled` | Tidak (tanya balik bila waktu ambigu) |
| `tambah beli susu ke tugas` / `add buy groceries to my to-do` | `todo.create` (+`dueAt` bila ada tanggal) | `write_local` | Tidak |
| `selesaikan tugas beli susu` / `mark buy groceries done` | `todo.complete` | `write_local` | **Ya** |
| `hapus tugas beli susu` / `delete buy groceries task` | `todo.delete` (permanen) | `write_local` | **Ya** |
| `hapus catatan belanja` | `note.delete` (arsip/soft-delete) | `write_local` | **Ya** |
| `tunda pengingat rapat 10 menit` / `snooze meeting reminder 10 minutes` | `reminder.snooze` | `scheduled` | **Ya** |
| `cari catatan belanja` / `search notes for shopping` | `notes.search` | `read_local` | Tidak |
| `cari tugas renovasi` | `tasks.query(scope=all, keyword)` | `read_local` | Tidak |
| `tugas hari ini` / `tugas menumpuk` / `semua tugas` (+EN: `tasks due today`, `overdue tasks`) | `tasks.query(today/overdue/all)` | `read_local` | Tidak |
| `timer 25 menit` / `fokus 25 menit` / `start 25-minute focus timer` / `25 menit` | `timer.start` | `scheduled` | Tidak |
| `catat: ide hadiah ulang tahun` / `note: ...` | `note.create` | `write_local` | Tidak |
| `jadwal rapat senin jam 10` / `schedule meeting monday at 10` | `calendar.create` (lokal, 1 jam) | `write_local` | **Ya** |
| `kirim notif ke topik KU: halo` / `push ...` | `ntfy.send` (**network**) | `external_write` | **Ya, selalu** |
| `... email ...` / `kirim email ...` | `unknown` + pesan disclosure | `external_write` | Ditolak-eksekusi (manual di panel) |

## Pencocokan judul (selesai/hapus/tunda)

- Semua kata kunci (> 2 huruf) harus terkandung di judul.
- 0 cocok → "tidak ada yang cocok dengan X".
- > 1 cocok → tampilkan 3 kandidat, minta sebutkan lebih spesifik.
- Contoh ambigu: `selesaikan tugas rapat` dengan 2 tugas "rapat" → parser
  menolak menebak, user harus memperjelas.

## Tanggal/waktu natural

Didukung (ID + EN): `besok`, `lusa`, `hari ini`, `today`, `tomorrow`,
`jam/pukul/at/@ HH[:.]MM + pagi/siang/sore/malam/am/pm`,
`dalam/in N menit/jam/detik`, nama hari (`senin..minggu`, `monday..sunday`).
Pengingat tanpa tanggal yang bisa diparse → balasan "Kapan pengingatnya?
Coba: 'ingatkan saya rapat besok jam 9 pagi'." (tidak mengarang waktu).

## Contoh respons tak dikenal

- Kosong: "Ketik perintah, mis. 'ingatkan saya bayar listrik besok jam 9 pagi'."
- Email: "Draf email butuh konfirmasi manual di panel Integrasi — DeskPet
  tidak mengirim otomatis."
- Default: "Belum paham. Coba: 'ingatkan deploy jam 4 sore' · 'tambah beli
  susu ke tugas' · 'selesaikan tugas beli susu' · 'tunda pengingat rapat
  10 menit' · 'cari catatan belanja' · 'tugas menumpuk' · 'timer 25 menit'."
