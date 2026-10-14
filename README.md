# DeskPet — P1 Foundation (Local-First Desktop Companion)

> PRD: [`DESKPET_PRD.md`](./DESKPET_PRD.md) adalah acuan utama (single source of truth). Kriteria rilis P1: *Karakter animasi desktop interaktif yang dapat digerakkan, disembunyikan, dan berjalan di Windows & macOS.*

---

## 📁 Struktur Direktori

```text
apps/desktop/              # Aplikasi Tauri 2 + React + TypeScript
  src/                     # App shell, MainPanel, PetCanvas, state machine, wander, parser, stores
    components/MainPanel.tsx   # Panel: asisten, pengingat, tugas, catatan, timer, kalender, auto, settings
    features/pet/          # state machine + useWander + PetContextMenu (klik kanan)
    features/assistant/    # parser NL deterministik ID/EN + validasi aksi
    lib/                   # store (localStorage), time, notify, tts, storage
  src-tauri/               # Backend Rust: SQLite, pet state, actions/permission, settings, tray, window
assets/characters/         # Paket aset karakter (Lavender Cat spritesheets, SVG, manifest)
docs/                      # Dokumentasi: architecture, build, privacy, testing
.ai/                       # Panduan & rules pengembangan
```

> Status PRD: P1 Foundation ✅ + inti P2–P4 lokal ✅ (pengingat berulang/snooze/quiet-hours, todos, notes autosave, timer, TTS, parser NL ID/EN, action registry + permission engine + audit di Rust, kalender lokal, otomatisasi terbatas, backup/restore). Google Calendar/Gmail tetap **opt-in stub** (belum terhubung — butuh OAuth + scope sempit, sengaja tidak auto-aktif demi privasi). Plugin dinamis ditunda per PRD (hanya modul first-party statis).

---

## 🛠️ Prasyarat Sistem

Sebelum menjalankan aplikasi, pastikan sistem Anda memiliki:
1. **Node.js**: Versi 20+ dan **npm** 10+
2. **Rust**: Versi stable (≥ 1.77) dengan toolchain:
   - **Windows**: [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) & WebView2 (sudah bawaan di Win 10/11)
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`)

---

## 🚀 Cara Menjalankan Aplikasi

Masuk ke direktori aplikasi desktop terlebih dahulu:

```bash
cd apps/desktop
npm install
```

### 1. Mode Desktop Lengkap (Rekomendasi)
Menjalankan aplikasi native Tauri dengan jendela transparan *always-on-top*, tray menu di taskbar, dan backend Rust SQLite:

```bash
npm run tauri dev
```
*(Jendela karakter pet akan muncul di desktop Anda dan ikon tray akan aktif).*

### 2. Mode Web Preview Cepat (Tanpa Compile Rust)
Jika Anda hanya ingin melihat tampilan karakter pet atau mengedit antarmuka frontend di browser:

```bash
npm run dev
```
Buka browser di [http://localhost:1420](http://localhost:1420). Status bar akan menampilkan mode `web-preview`.

---

## 🎮 Kontrol & Interaksi Karakter

- **Drag & Drop**: Klik kiri tahan + geser pada karakter untuk memindahkannya. Ada threshold 5px sehingga klik biasa tidak dikira drag (tidak bocor ke UI belakang). Lepas drag otomatis kembali ke `idle` tanpa perlu klik lagi (dideteksi via `window mouseup/blur` karena `startDragging()` mengambil alih event OS).
- **Sapa**: Klik (tap) pada pet memicu animasi gembira (`react`). Dobel-klik membuka panel Asisten.
- **Menu klik kanan**: Klik kanan pada pet membuka menu konteks (Asisten, Pengingat, Tugas, Catatan, Timer, Kalender, Otomatisasi, Pengaturan, jalan otomatis, ukuran pet, selalu-di-atas, gerakan tenang, tidur/bangun, sembunyikan, keluar). Tidak ada lagi bar opsi permanen di bawah pet.
- **Jalan otomatis**: Pet berjalan sendiri tiap 5–11 detik ke arah acak kiri/kanan + naik/turun (state `walk` + jendela berpindah, sprite menghadap arah jalan). Bisa dimatikan via menu / Pengaturan. Otomatis jeda saat menu/panel terbuka, saat di-drag, tidur, atau reduced-motion. Mode web-preview menggeser CSS di sumbu X dan Y.
- **Ukuran pet (scale)**: Atur 50%–200% via menu klik kanan (🔍＋/🔍－/↩) atau slider di Pengaturan. Berlaku untuk sprite maupun placeholder, menghadap kiri/kanan tetap benar (`scale(facing*scale, scale)`), dan ukuran jendela Tauri menyesuaikan agar tidak terpotong.
- **Sembunyikan / Tampilkan**: via menu klik kanan → 🙈, tray (Show/Hide), atau shortcut `Ctrl + Shift + D` (Windows) / `Cmd + Shift + D` (macOS).

---

## 🧪 Menjalankan Pengujian (Tests)

Semua pengujian berjalan secara lokal:

```bash
# Uji unit frontend (Vitest: PetCanvas, state machine, storage)
npm test

# Uji backend Rust (Cargo tests: SQLite migrations, pet state validation, privacy settings)
npm run test:rust

# Jalankan semua pengujian sekaligus
npm run test:all
```

---

## 📦 Build Installer Produksi

Untuk menghasilkan installer native executable:

```bash
npm run tauri build
```

Hasil bundle tersimpan di:
- **Windows**: `apps/desktop/src-tauri/target/release/bundle/msi/` dan `nsis/` (`.exe` / `.msi`)
- **macOS**: `apps/desktop/src-tauri/target/release/bundle/dmg/` dan `macos/` (`.dmg` / `.app`)

---

## 🔒 Kebijakan Privasi (Privacy-First)

- **Local-first**: Seluruh data dan pengaturan tersimpan di SQLite lokal perangkat (`<app_local_data>/deskpet.db`).
- **Zero Telemetry**: Tidak ada pelacakan, analytics, atau data pengguna yang dikirim ke internet.
- Lihat detail lengkap di [`docs/privacy.md`](./docs/privacy.md).
