# Cara rilis (agar ada file download di halaman Releases)

Ada **dua cara** memasukkan installer ke GitHub Releases. Keduanya sah;
cara B yang direkomendasikan untuk proyek public.

## Konsep penting (kenapa tidak bisa asal upload dari satu laptop)

Tauri **tidak bisa cross-compile bundle antar-OS**: installer Windows
(`.exe`/`.msi`, butuh MSVC + WebView2) hanya bisa dibuat di Windows,
installer macOS (`.dmg`/`.app`, butuh Xcode toolchain) hanya di macOS.
Jadi tiap OS butuh mesin/runner aslinya. Signing/notarization juga
per-OS dan butuh sertifikat sendiri.

## Cara A — manual (build sendiri, lampirkan via web)

Cocok bila hanya rilis sesekali dan Anda punya kedua mesin.

1. Di **Windows**:
   ```bash
   cd apps/desktop
   npm ci
   npm run test:all
   npm run tauri build
   ```
   Ambil file dari `src-tauri/target/release/bundle/`:
   `nsis/*.exe` + `msi/*.msi`.
2. Di **macOS** (atau sebaliknya), perintah sama; ambil `dmg/*.dmg`.
3. Buat checksum tiap file:
   ```bash
   # Windows (PowerShell)
   Get-FileHash *.exe, *.msi -Algorithm SHA256
   # macOS
   shasum -a 256 *.dmg
   ```
4. Buka `https://github.com/alfiansetia/DeskPet/releases` → **Draft a new
   release** → isi tag `v0.1.0`, judul, tempel isi
   [`.github/RELEASE_NOTES_v0.1.0.md`](../.github/RELEASE_NOTES_v0.1.0.md)
   → seret file installer ke kolom asset → **Save draft** (cek dulu)
   → **Publish** bila sudah yakin.

## Cara B — otomatis via GitHub Actions (rekomendasi) ✅

Repo ini sudah punya [`.github/workflows/release.yml`](../.github/workflows/release.yml):
tiap push tag `v*`, GitHub menjalankan 3 job paralel
(Windows x64, macOS ARM, macOS Intel): install deps → `test:all` (gate;
gagal = tidak rilis) → `tauri build` → hasilnya otomatis dilampirkan ke
sebuah **draft release**. Anda tinggal review → publish.

Langkah rilis:

```bash
# 1. Pastikan main hijau dan docs sudah commit
git checkout main && git pull
npm run test:all --prefix apps/desktop

# 2. Commit versi (sinkronkan 3 tempat)
#    - apps/desktop/package.json        -> "version": "0.1.0"
#    - apps/desktop/src-tauri/Cargo.toml -> version = "0.1.0"
#    - apps/desktop/src-tauri/tauri.conf.json -> "version": "0.1.0"
#    - updates/stable.json -> version + notes (untuk update checker)

# 3. Tag + push (ini yang memicu workflow)
git tag v0.1.0
git push origin main v0.1.0

# 4. Tunggu ±15–30 mnt di tab Actions, lalu buka Releases:
#    lengkapi body (tempel RELEASE_NOTES_v0.1.0.md + checksum),
#    Save draft -> Publish.
```

Melihat progres: tab **Actions** → run "Release" → tiap job menampilkan
log build per OS. Bila merah, klik job-nya untuk lihat error (umumnya:
versi Node/Rust, ikon hilang, atau test gate gagal).

## Setelah publish

1. Update `updates/stable.json` (`version`, `notes`, `url` ke halaman
   rilis) bila ingin update checker menunjuk ke rilis ini — commit terpisah.
2. Tambahkan entri baru di `CHANGELOG.md` untuk versi berikutnya
   (`## [Unreleased]`).
3. Untuk rilis bertanda (P5): beli/urus sertifikat (Windows code-signing,
   Apple Developer ID), simpan sebagai GitHub Secrets, lalu aktifkan
   signing di workflow (lihat komentar di `release.yml` +
   [`docs/build-windows-macos.md`](./build-windows-macos.md)).
