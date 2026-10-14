# DeskPet — P1 Foundation (Local-First Desktop Companion)

> PRD: [`DESKPET_PRD.md`](./DESKPET_PRD.md) adalah acuan utama (single source of truth). Kriteria rilis P1: *Karakter animasi desktop interaktif yang dapat digerakkan, disembunyikan, dan berjalan di Windows & macOS.*

---

## 📁 Struktur Direktori

```text
apps/desktop/              # Aplikasi Tauri 2 + React + TypeScript
  src/                     # Komponen PetCanvas, state machine, App, CSS
  src-tauri/               # Backend Rust: SQLite, pet state, settings, tray, window
assets/characters/         # Paket aset karakter (Lavender Cat spritesheets, SVG, manifest)
docs/                      # Dokumentasi: architecture, build, privacy, testing
.ai/                       # Panduan & rules pengembangan
```

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

- **Drag & Drop**: Klik kiri tahan pada karakter pet untuk memindahkannya ke posisi mana pun di desktop.
- **Interaksi / Reaksi**: Klik (tap) pada karakter pet untuk memicu animasi gembira (`react`).
- **Sembunyikan / Tampilkan (Hide/Show)**:
  - Tombol **Hide / Show** pada menu cepat.
  - Shortcut keyboard: `Ctrl + Shift + D` (Windows) atau `Cmd + Shift + D` (macOS).
  - Klik kanan pada ikon tray di taskbar/menu bar.
- **Always on Top**: Tombol **Top:on/off** untuk mengatur apakah pet selalu berada di atas jendela lain.
- **Reduced Motion**: Tombol **Motion:calm/full** untuk mode aksesibilitas (mematikan animasi cepat).
- **Zzz / Wake**: Memasukkan pet ke mode tidur lelap atau membangunkannya kembali.

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
