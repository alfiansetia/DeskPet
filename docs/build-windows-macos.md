# Build & run — Windows & macOS

## Prasyarat

- Node.js 20+ / npm 10+ (`node -v`, `npm -v`).
- Rust stable ≥ 1.77 (`rustc -V`), diuji hingga 1.99.
- Windows 10/11 (min `10.0.17763.0`): Visual Studio C++ Build Tools (MSVC) +
  WebView2 (sudah bawaan di Win 10/11).
- macOS 11+ (`macOS.minimumSystemVersion 11.0`): Xcode CLT
  (`xcode-select --install`) + target
  `aarch64-apple-darwin` / `x86_64-apple-darwin`.

## Dev (aplikasi native penuh)

```bash
cd apps/desktop
npm install
npm run tauri dev
```

Yang terjadi: window pet transparan muncul; ikon tray aktif (Show/Hide/
Toggle-top/Quit); SQLite diinisialisasi di `<app_local_data>/deskpet.db`.

## Preview web cepat (tanpa compile Rust)

```bash
cd apps/desktop
npm run dev
# buka http://localhost:1420 — badge "web-preview"
```

Keterbatasan preview: tanpa multi-window, tray, SQLite file, autostart.
Jangan klaim fitur native lolos uji hanya dari preview.

> Catatan Windows: `vite.config.ts` mengabaikan `src-tauri/target/**` di
> `server.watch`, kalau tidak Vite crash `EBUSY ... build_script_build-*.exe`
> saat `tauri dev`. Jalankan tes Rust dari `apps/desktop/src-tauri`
> (`cargo test`), bukan dari `apps/desktop`.

## Bundle produksi

```bash
cd apps/desktop
npm run tauri build
```

| OS | Output | Catatan |
| --- | --- | --- |
| Windows 10/11 | `src-tauri/target/release/bundle/{msi,nsis}/` | Butuh WebView2 di target |
| macOS 11+ | `src-tauri/target/release/bundle/{dmg,app}/` | Wajib sign + notarize sebelum distribusi publik (P5) |

Deskripsi bundle: "Local-first desktop companion". Target aktif:
`msi, nsis, dmg, app`. Kategori: Utility.

## Update channel

`features/updater` membaca [`updates/stable.json`](../updates/stable.json)
(`version`, `notes`, `url` rilis GitHub). Naikkan versi + catat di
`CHANGELOG.md` setiap rilis.

## Signing / notarization (wajib sebelum rilis publik)

- Windows: code-signing cert untuk MSI/NSIS (kalau tidak, SmartScreen
  memberi peringatan — jelaskan ke user, jangan disembunyikan).
- macOS: Developer ID + `notarization` untuk DMG/APP (kalau tidak, Gatekeeper
  memblokir — sediakan instruksi bypass resmi yang aman).
- Publikasikan checksum per artefak (lihat PRD §16).

## Smoke test (wajib tiap OS target)

1. Pet tampil, animasi idle.
2. Drag memindah window; state `dragged` saat ditekan; lepas → `idle`.
3. Hide via menu/tray/`Ctrl/Cmd+Shift+D`; tampil kembali.
4. Klik = sapa; tahan = elus; dobel-klik = Asisten; klik kanan = menu.
5. Buka tiap tab panel; tambah 1 pengingat/tugas/catatan/timer.
6. Restart app: data tetap ada; window sekunder kembali (multi-pet).
7. Matikan network: fitur inti jalan; pill sholat/cuaca label "offline".
8. Multi-monitor/DPI/sleep-wake: pindah layar, ubah skala, sleep lalu bangun.
