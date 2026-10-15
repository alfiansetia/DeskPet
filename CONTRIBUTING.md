# Contributing to DeskPet

Terima kasih sudah mau berkontribusi! DeskPet adalah proyek open-source
local-first / privacy-first. Kontribusi kode, aset, dokumentasi, dan laporan
bug semuanya diterima.

> Aturan main singkat: **Rust adalah otoritas** untuk data, validasi, izin,
> dan eksekusi aksi. Jangan tambahkan telemetri, shell sembarangan, atau
> integrasi cloud yang auto-aktif.

## Cara mulai

1. Fork repo ini, lalu clone fork Anda.
2. Baca `DESKPET_PRD.md` (source of truth produk) dan `docs/architecture.md`.
3. Siapkan prasyarat: Node.js 20+ / npm 10+, Rust stable ≥ 1.77.
   - Windows: Visual Studio C++ Build Tools + WebView2 (bawaan Win 10/11).
   - macOS: `xcode-select --install`.
4. Jalankan dev mode:

```bash
cd apps/desktop
npm install
npm run tauri dev   # aplikasi native
# atau: npm run dev # preview web cepat di http://localhost:1420
```

## Alur kontribusi

1. Buat branch dari `main`: `git checkout -b feat/nama-fitur`.
2. Kerjakan dalam milestone kecil yang bisa dites (jangan satu PR raksasa).
3. Tambahkan/perbarui **test** untuk setiap fitur:
   - Frontend: `npm test` (Vitest).
   - Backend: `npm run test:rust` (cargo test).
   - Typecheck + build: `npx tsc --noEmit` dan `npm run build`.
4. Perbarui dokumentasi bila perilaku berubah (`README.md`, `docs/*`,
   `CHANGELOG.md` bila perlu).
5. Pastikan tidak ada rahasia/kunci API yang ikut ter-commit.
6. Buka Pull Request ke `main` dengan deskripsi jelas:
   - Apa yang berubah dan kenapa.
   - Cara mengetes (perintah + hasil).
   - Screenshot/GIF bila ada perubahan UI.
   - Dampak privasi (apakah ada network baru? data baru? izin baru?).

## Standar kode

- TypeScript: ketat (`tsc --noEmit` harus hijau), hindari `any` tanpa alasan.
- Rust: `cargo test` hijau; validasi input di Rust, bukan hanya di UI.
- Jangan eksekusi perintah shell dari output AI/parser.
- Jangan simpan token/secret di SQLite plaintext atau di kode frontend.
- Log hanya metadata — **jangan** log isi catatan, email, prompt, atau body privat.
- Hormati `quiet-hours`, `reduced-motion`, dan mode mute yang sudah ada.
- Ikuti pola yang ada: `store.*.save()` untuk data shared (otomatis live-sync
  antar-window via `notifyDataChanged`), `toast()` untuk info ringan,
  `routeOrPresent()` untuk alert penting.

## Aset karakter

- Satu folder per spesies di `assets/characters/<spesies>/`.
- Sertakan `manifest.json` + sebutkan lisensi/atribusi sumbernya.
- Jangan memasukkan aset berhak cipta tanpa izin (dilarang menjiplak
  karakter komersial). Lebih aman: buat original atau pakai aset CC0/MIT
  dengan atribusi yang benar.
- Jaga dimensi frame konsisten per animasi, tanpa background baked-in.

## Melaporkan bug

Gunakan template issue yang tersedia (`.github/ISSUE_TEMPLATE/`). Sertakan:

- Versi DeskPet + OS (Windows 10/11 / macOS versi berapa).
- Mode: native (`tauri dev` / installer) atau web-preview.
- Langkah reproduksi + yang diharapkan vs yang terjadi.
- Log relevan (tab Log di aplikasi, atau file log via perintah `log_path`).

## Keamanan

Jangan buka issue publik untuk celah keamanan — lihat `SECURITY.md`.

## Lisensi

Dengan berkontribusi, Anda setuju bahwa kontribusi Anda dilisensikan di bawah
[MIT License](./LICENSE), kecuali aset yang Anda nyatakan berlisensi lain
secara eksplisit di manifest-nya.
