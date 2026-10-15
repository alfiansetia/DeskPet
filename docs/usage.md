# Panduan pakai (user guide)

Untuk pengguna harian DeskPet — bukan untuk developer.
Untuk instalasi/build lihat [`docs/build-windows-macos.md`](./build-windows-macos.md);
untuk daftar fitur teknis lihat [`docs/features.md`](./features.md).

## 1. Menjalankan

```bash
cd apps/desktop
npm install
npm run tauri dev   # jendela pet + tray aktif (rekomendasi)
```

Alternatif ringan (tanpa compile Rust, untuk intip UI):

```bash
npm run dev  # buka http://localhost:1420, badge "web-preview"
```

Installer produksi: `npm run tauri build` → hasil di
`src-tauri/target/release/bundle/` (`msi`/`nsis` di Windows, `dmg`/`app` di macOS).

## 2. Kontrol karakter (wajib hafal)

| Aksi | Hasil |
| --- | --- |
| Klik kiri tahan + geser | Pindah posisi (threshold 5 px; klik biasa tidak bocor) |
| Klik (tap) | Sapa: animasi `react` + bubble teks acak |
| Tahan 500 ms | Elus: hati + bunyi + hitungan (buka topi baru) |
| Dobel-klik | Buka panel Asisten |
| Klik kanan | Menu konteks (semua aksi — tidak ada bar tombol permanen) |
| `Ctrl+Shift+D` / `Cmd+Shift+D` | Sembunyi/tampil |
| `Esc` | Konfirmasi alert → tutup bubble; kalau tidak ada alert → tutup menu/panel |

Menu klik kanan berisi: Asisten, Pengingat, Tugas, Catatan, Timer (5/15/25),
Kalender, Otomatisasi, Pengaturan, jalan otomatis on/off, kecepatan, arah,
ukuran pet, always-on-top, gerakan tenang, tidur/bangun, kasih makan,
ajak main, sembunyikan, keluar.

## 3. Panel per tab (cara pakai singkat)

- **Asisten:** ketik perintah (lihat cheat sheet di bawah) → baca preview →
  konfirmasi hanya bila diminta. Label jelas: diproses lokal vs butuh network.
- **Pengingat:** tambah (judul + waktu + recurrence) → snooze/tunda,
  selesaikan, hapus. Hormati quiet-hours (default 22–07).
- **Tugas:** tambah + prioritas + due date; filter status/prioritas; cari;
  klik untuk selesai. Nudge otomatis 13:00 & 17:30 bila ada yang terbuka
  (bisa dimatikan di Otomatisasi).
- **Catatan:** ketik → autosave otomatis (600 ms, ada status simpan);
  hapus = soft-delete (bisa restore); export/import via tombol.
- **Timer:** pilih 5/15/25 mnt atau custom + label. Countdown tampil di semua
  window; hanya berbunyi sekali (primary yang eksekusi).
- **Kalender:** acara lokal (judul + mulai + selesai + lokasi). Google =
  stub terputus (sengaja belum OAuth demi privasi).
- **🌙 Jadwal sholat:** pilih kota (sama untuk cuaca) → countdown otomatis +
  kartu 8 waktu (Imsak–Isya). Atur H-X menit, adzan beep, bubble, TTS.
  Offline tetap tampil dari cache (label "offline").
- **Otomatisasi:** 4 bawaan (ringkasan pagi weekday 09:00, bacakan pengingat,
  review Jumat — default off, nudge tugas). Toggle + `lastRun` terlihat.
- **ntfy:** isi server + topic + aktifkan → pesan masuk jadi alert.
  Opsional: simpan sebagai pengingat, bacakan via TTS.
- **Kawan:** tambah companion (pilih spesies/warna/role/ukuran) → tampilkan →
  hapus bila perlu (maks 5; `main` tidak bisa dihapus). Atur pill suhu/mini
  per-pet + mode pemalu + gaya jalan per-pet.
- **Pengaturan:** always-on-top, reduced-motion, mute suara/bicara, wander,
  quiet-hours, spesies/palet/warna custom, skala 50–200%, prayer, cuaca,
  center-on-alert, autostart, backup/restore, topi, stat pet.
- **Tentang:** versi + info build + tautan.
- **Log:** audit aksi & akses eksternal (metadata saja) + file log lokal.

## 4. Cheat sheet asisten (ID + EN)

```
ingatkan saya bayar listrik besok jam 9 pagi
remind me to deploy at 4 pm
tambah beli susu ke tugas            | add buy groceries to my to-do
selesaikan tugas beli susu           | mark buy groceries done
tunda pengingat rapat 10 menit       | snooze meeting reminder 10 minutes
hapus tugas beli susu                | delete buy groceries task
hapus catatan belanja
cari catatan belanja                 | search notes for shopping
tugas hari ini / tugas menumpuk / semua tugas
timer 25 menit                       | start 25-minute focus timer
jadwal rapat senin jam 10            | schedule meeting monday at 10
kirim notif ke topik KU: halo        (network, selalu konfirmasi)
```

Aturan konfirmasi: baca-lokal langsung jalan; tulis/terjadwal penting,
kalender, dan ntfy selalu preview + konfirmasi. Email = selalu ditolak
eksekusi otomatis ("butuh konfirmasi manual di panel Integrasi").

## 5. Backup & pindah perangkat

1. Buka Pengaturan → Backup → Export → simpan file JSON.
2. Di perangkat baru: Pengaturan → Backup → Import → pilih file.
3. Isi ikut: pengingat, tugas, catatan, acara, otomatisasi, settings,
   daftar kawan, config ntfy. Versi backup saat ini: **2**.

## 6. Kawan (multi-pet) dalam 1 menit

1. Buka tab Kawan → isi nama → pilih spesies/warna/role/ukuran → Tambah.
2. Klik Tampilkan → window baru muncul cascade (+60 px).
3. Role menentukan siapa yang present alert:
   `all` = semua; `reminder`/`prayer`/`timer` = sesuai jenis;
   `decor` = hiasan, tidak pernah present.
4. Semua window melihat data yang sama (single shared DB). Yang
   per-window hanya: spesies/warna/skala/role/pill/shy/gaya jalan.

## 7. Jadwal sholat & cuaca dalam 1 menit

1. Tab 🌙 → pilih kota (mis. KOTA JAKARTA `1301`).
2. Tunggu 1x fetch (butuh internet sekali) → countdown + kartu tampil.
3. Besoknya offline pun tetap tampil (cache harian).
4. Atur: H-X menit (0–30), bunyi adzan, bubble besar, TTS, pill suhu/mini.

## 8. Kalau ada alert besar (pet membesar + bubble)

Itu **fokus alert**: pengingat/timer/waktu sholat/ringkasan pagi. Cara
menutup: klik pet, klik bubble, klik toast, atau tekan `Esc`.
Nonaktifkan perilaku kembali-ke-tengah via Pengaturan → "Kembali ke tengah
layar saat alert penting" (`centerOnAlert`).
