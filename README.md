# 🐾 DeskPet — Local-First Desktop Companion

> **Karakter animasi di desktop + asisten produktivitas lokal (pengingat,
> tugas, catatan, timer, jadwal sholat, cuaca) — tanpa akun, tanpa cloud
> wajib, tanpa telemetri.** Dibangun dengan **Tauri 2 + Rust + React +
> TypeScript + SQLite**. Berjalan di **Windows 10/11 & macOS**.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-blue.svg)](https://v2.tauri.app/)
[![PRD](./DESKPET_PRD.md)](./DESKPET_PRD.md)

**Acuan utama:** [`DESKPET_PRD.md`](./DESKPET_PRD.md) (single source of truth).
**Status:** fondasi P1 ✅ + inti lokal P2–P4 ✅ (lihat
[`CHANGELOG.md`](./CHANGELOG.md), [`docs/p1-report.md`](./docs/p1-report.md),
[`docs/p2-report.md`](./docs/p2-report.md)).

```text
apps/desktop/              # Aplikasi Tauri 2 + React + TypeScript
  src/                     # Shell App, 13-tab panel, pet, parser, stores, prayer/weather/ntfy
    App.tsx                # Shell: interaksi pet, scheduler primary, alert routing, resize
    components/MainPanel.tsx # Panel: asisten, pengingat, tugas, catatan, timer,
                             # kalender, sholat, auto, ntfy, kawan, settings, tentang, log
    features/pet/          # State machine, wander, companions, menu klik kanan,
                           # species/palette/hats/care/greetings
    features/assistant/    # Parser NL deterministik ID/EN + validasi aksi
    features/prayer/       # Jadwal sholat cache-first (MyQuran → Aladhan)
    features/weather/      # Cuaca Open-Meteo tanpa API key
    features/apiwatch/     # ntfy SSE opt-in
    lib/                   # store, time, notify, tts, sfx, timer, settingsSync, appLog
  src-tauri/               # Backend Rust: SQLite, pet registry, actions/permission,
                           # settings, applog, tray, window, autostart
    migrations/            # 001_init, 002_actions, 003_shared
assets/characters/         # Paket karakter (cat, snake, frog, owl, penguin + manifest)
docs/                      # Arsitektur, fitur, panduan pakai, parser, konfigurasi,
                           # build, testing, privasi, troubleshooting
updates/stable.json        # Channel info versi
```

---

## ✨ Fitur (ringkas)

| Area | Isi |
| --- | --- |
| 🐱 Karakter | 5 spesies recolorable, 8 state animasi, drag, klik = sapa, tahan = elus, dobel-klik = asisten, klik kanan = menu, jalan otomatis, mode pemalu, topi unlockable, stat Tamagotchi-lite |
| 👥 Multi-kawan | Hingga 5 window (1 per companion), role presenter alert, scheduler terpusat anti-duplikat, live-sync, restore saat restart |
| 📋 Produktivitas lokal | Pengingat (recurrence/snooze/quiet-hours), tugas, catatan (autosave + soft-delete), timer fokus terpusat, kalender lokal, otomatisasi bawaan |
| 💬 Asisten NL | Parser deterministik **ID + EN tanpa AI** (pengingat/todo/catatan/timer/query/kalender/tunda/hapus/selesai/cari/ntfy) + validasi Rust + audit |
| 🌙 Sholat + cuaca | Kota bersama; MyQuran/Kemenag → fallback Aladhan; Open-Meteo tanpa key; cache-first offline; pill rotasi; adzan beep + TTS opsional; reaksi hujan |
| 🔔 ntfy opt-in | Subscribe SSE topic; simpan-sebagai-pengingat; TTS opsional |
| 🔒 Privasi | Local-first, zero telemetry, permission engine, log metadata-saja, backup/restore eksplisit |

Detail penuh: [`docs/features.md`](./docs/features.md).
Google Calendar/Gmail = **stub opt-in terputus** (belum OAuth — butuh
client-id + verifikasi provider + token di OS keychain; sengaja tidak
auto-aktif demi privasi). Plugin dinamis ditunda per PRD §5.8.

---

## 🛠️ Prasyarat

1. **Node.js** 20+ dan **npm** 10+.
2. **Rust** stable ≥ 1.77:
   - **Windows:** [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
     + WebView2 (sudah bawaan di Win 10/11).
   - **macOS:** Xcode Command Line Tools (`xcode-select --install`).

---

## 🚀 Menjalankan

```bash
cd apps/desktop
npm install
```

### 1. Mode desktop penuh (rekomendasi)

Native Tauri: window transparan always-on-top + tray + backend Rust SQLite:

```bash
npm run tauri dev
```

### 2. Preview web cepat (tanpa compile Rust)

Untuk intip/edit UI di browser (badge `web-preview`, tanpa tray/SQLite penuh):

```bash
npm run dev
# buka http://localhost:1420
```

---

## 🎮 Kontrol karakter

- **Drag:** klik kiri tahan + geser (threshold 5 px; klik biasa tidak bocor).
  Lepas = kembali `idle` otomatis (via `window mouseup/blur`).
- **Klik:** sapa (`react` + bubble teks acak, ikut konteks hujan/lapar).
  **Tahan 500 ms:** elus (hati + bunyi + hitungan; buka topi 🧢/🥳/👑 di
  0/5/15 elusan). **Dobel-klik:** buka Asisten. **Hover:** menoleh ke kursor.
- **Klik kanan:** menu konteks (Asisten, Pengingat, Tugas, Catatan, Timer,
  Kalender, Otomatisasi, Pengaturan, jalan otomatis, kecepatan, arah, ukuran
  pet 50–200%, always-on-top, gerakan tenang, tidur/bangun, kasih makan,
  ajak main, sembunyikan, keluar). Tidak ada bar tombol permanen.
- **Jalan otomatis:** tiap 5–11 dtk (`walk` + pindah window, sprite flip).
  Jeda saat menu/panel terbuka, di-drag, tidur, hover, alert, mood rendah,
  atau reduced-motion.
- **Fokus alert:** pengingat/timer/sholat/ringkasan pagi → pet ke tengah +
  membesar sampai dikonfirmasi (**klik pet / bubble / toast / `Esc`**).
  Matikan via Pengaturan → "Kembali ke tengah layar saat alert penting".
- **Sembunyi/tampil:** menu → 🙈, tray Show/Hide, atau
  `Ctrl+Shift+D` (Windows) / `Cmd+Shift+D` (macOS).

Panduan harian lengkap: [`docs/usage.md`](./docs/usage.md).

---

## 💬 Asisten (contoh perintah)

```text
ingatkan saya bayar listrik besok jam 9 pagi
tambah beli susu ke tugas
selesaikan tugas beli susu
tunda pengingat rapat 10 menit
cari catatan belanja
tugas menumpuk
timer 25 menit
jadwal rapat senin jam 10
kirim notif ke topik KU: halo   (network, selalu konfirmasi)
```

Cheat sheet lengkap (ID + EN + aturan konfirmasi):
[`docs/assistant-parser.md`](./docs/assistant-parser.md).

---

## 🌙 Sholat, cuaca, kawan (intisari)

- **Sholat:** pilih kota di tab 🌙 (dipakai bersama cuaca) → countdown +
  kartu 8 waktu. Cache harian → tetap tampil **offline**. H-X menit (0–30),
  adzan beep offline, bubble besar, TTS — semuanya bisa diatur.
- **Cuaca:** suhu + kondisi via Open-Meteo (tanpa key); pill suhu berbagi slot
  dengan countdown (rotasi ±4 dtk); hujan → toast sekali per transisi.
- **Kawan:** tab Kawan → tambah (spesies/warna/role/ukuran) → tampilkan
  (maks 5). Role (`all/reminder/prayer/timer/decor`) menentukan siapa yang
  present alert. Semua window melihat **data yang sama**.

Referensi semua pengaturan: [`docs/configuration.md`](./docs/configuration.md).

---

## 🧪 Testing

```bash
cd apps/desktop
npm test          # Vitest frontend
npm run test:rust # cargo test backend
npm run test:all  # keduanya
npx tsc --noEmit  # typecheck
npm run build     # build frontend
```

Lihat [`docs/testing.md`](./docs/testing.md) untuk cakupan + batas uji manual.

---

## 📦 Build installer

```bash
cd apps/desktop
npm run tauri build
```

- **Windows:** `src-tauri/target/release/bundle/msi/` dan `nsis/`.
- **macOS:** `src-tauri/target/release/bundle/dmg/` dan `macos/`.
- Distribusi publik wajib **signing + notarization** + checksum
  (lihat [`docs/build-windows-macos.md`](./docs/build-windows-macos.md)).

---

## 🔒 Privasi

- **Local-first:** data + settings di SQLite perangkat
  (`<app_local_data>/deskpet.db`) + `deskpet:*` lokal.
- **Zero telemetry:** tanpa pelacakan/analytics; validator menolak
  `telemetry=true`.
- **Permission-based:** validasi Rust + allowlist; tulis eksternal selalu
  preview + konfirmasi; log = metadata saja.
- Detail + tabel network: [`docs/privacy.md`](./docs/privacy.md).

---

## 📚 Dokumentasi

| Dokumen | Isi |
| --- | --- |
| [`DESKPET_PRD.md`](./DESKPET_PRD.md) | PRD — source of truth produk |
| [`docs/features.md`](./docs/features.md) | Manual fitur lengkap |
| [`docs/usage.md`](./docs/usage.md) | Panduan pakai harian + cheat sheet |
| [`docs/assistant-parser.md`](./docs/assistant-parser.md) | Parser NL: tabel perintah ID/EN |
| [`docs/configuration.md`](./docs/configuration.md) | Referensi semua settings |
| [`docs/architecture.md`](./docs/architecture.md) | Arsitektur + multi-pet + migrasi DB |
| [`docs/build-windows-macos.md`](./docs/build-windows-macos.md) | Build, signing, smoke test |
| [`docs/testing.md`](./docs/testing.md) | Perintah + cakupan test |
| [`docs/privacy.md`](./docs/privacy.md) | Jaminan privasi + tabel network |
| [`docs/troubleshooting.md`](./docs/troubleshooting.md) | FAQ + perbaikan umum |
| [`CHANGELOG.md`](./CHANGELOG.md) | Riwayat rilis |

---

## 🤝 Kontribusi & keamanan

- Kontribusi: [`CONTRIBUTING.md`](./CONTRIBUTING.md) (baca sebelum buka PR).
- Keamanan: [`SECURITY.md`](./SECURITY.md) (**jangan** lapor celah via issue publik).
- Perilaku: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).
- Template issue/PR tersedia di `.github/`.

## 📄 Lisensi

Kode: [MIT](./LICENSE) © 2026 Alfian Setiawan.
Aset karakter: lisensi terpisah per `assets/characters/<spesies>/manifest.json` —
periksa atribusi sebelum distribusi (jangan sertakan aset berhak cipta tanpa izin).
