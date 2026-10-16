# Troubleshooting & FAQ

## App tidak jalan / window pet tidak muncul

1. Cek prasyarat: Node 20+ (`node -v`), Rust stable (`rustc -V`),
   build tools OS (lihat [`docs/build-windows-macos.md`](./build-windows-macos.md)).
2. `cd apps/desktop && npm install` lalu `npm run tauri dev`; baca error
   pertama di terminal (sering: MSVC/WebView2 di Windows, CLT di macOS).
3. Tray icon ada tapi pet tak terlihat? Klik tray → **Show pet**, atau tekan
   `Ctrl+Shift+D` / `Cmd+Shift+D`. Close window = hide (bukan quit), jadi
   app bisa "hidup tapi tak terlihat".

## `npm run dev` vs `npm run tauri dev`

- `npm run dev` = preview web di browser (badge `web-preview`).
  Multi-window, tray, SQLite file, autostart **tidak** berfungsi penuh.
- `npm run tauri dev` = aplikasi native asli (Rust + SQLite + tray).
  Selalu uji fitur penting di mode ini.

## Notifikasi / suara tidak bunyi

- Cek izin notifikasi OS untuk DeskPet; bila ditolak, app menampilkan
  fallback toast (bukan diam).
- Cek `soundMuted` / `speechMuted` di Pengaturan (TTS default **mati**).
- Cek quiet-hours (default 22–07): bunyi adzan/TTS dihormati/ditahan.
- Timer selesai tanpa alert? Cek `timerDoneAlertEnabled`.

## Jadwal sholat / cuaca tidak tampil

- Butuh internet **sekali** untuk fetch hari itu; setelahnya cache harian
  tetap tampil offline (label "offline").
- Pastikan kota benar (tab 🌙; kota dipakai bersama sholat + cuaca).
- Cek master switch: `prayerEnabled`, `weatherEnabled`, `tempBubbleEnabled`,
  `prayerMiniEnabled`. Per-window: `showTemp`/`showMini` di tab Kawan.
- Praktis: pill suhu + countdown berbagi satu slot (rotasi ±4 dtk) — bukan bug.

## Pengingat "tidak bunyi"

- Scheduler tick 5 dtk hanya jalan saat app berjalan (tidak ada janji bunyi
  saat komputer mati — lihat PRD non-goals).
- Cek status pengingat (`active` vs `snoozed/completed/dismissed`),
  quiet-hours, dan `lastTriggeredAt` (dedup mencegah bunyi ganda).
- Setelah sleep/restart: missed-handling menandai yang terlewat — buka tab
  Pengingat untuk melihatnya.
- Bubble hilang terlalu cepat? Atur Pengaturan → "Bubble alert hilang"
  (`alertDurationSec`). Default `0` = nempel sampai diklik; kalau diset
  1 mnt / 5 mnt / 30 mnt / 1 jam, bubble auto-close setelah durasi itu.

## Timer "ga work" / countdown beda antar-window

- Timer itu terpusat: countdown shared, hanya primary (`main`) yang
  mengeksekusi selesai. Semua window menampilkan angka yang sama.
- Jangan start timer dari window sekunder lalu tutup primary — biarkan
  window `main` tetap hidup.

## Multi-window: alert muncul di pet yang "salah"

- Itu routing by **role** (`resolvePresenterFor`): cek role tiap companion
  di tab Kawan. `decor` tidak pernah present; pastikan ada presenter untuk
  jenis alert itu (`reminder/prayer/timer` atau `all`).
- Pill tiap pet memang berganti tidak barengan (fase + jitter per-id) —
  disengaja agar tidak sinkron.

## Data hilang / ingin pindah perangkat

- Data hidup di `deskpet:settings` dkk. (localStorage) + `deskpet.db`
  (SQLite app-data). Selalu **Export backup** dari Pengaturan sebelum
  reinstall/pindah, lalu **Import** di perangkat baru.
- File backup harus `app === "deskpet"` (versi 2 mencakup companions +
  api-config). Pesan "Bukan file backup DeskPet" = file salah.

## Build installer gagal

- Windows: pastikan MSVC Build Tools + WebView2; target bundle
  `msi`/`nsis` di `src-tauri/target/release/bundle/`.
- macOS: `xcode-select --install`; target `dmg`/`app`. Distribusi publik
  butuh signing + notarization (lihat build doc).
- `tauri build` belum pernah dijalankan di CI repo ini — klaim rilis harus
  dibuktikan dengan build di tiap OS target + smoke test.

## Ikon tray/bundle jelek

- Diketahui: ikon masih placeholder; `tray init failed` non-fatal (logged).
  Ganti `src-tauri/icons/*` (termasuk `icon.icns` untuk macOS) sebelum
  rilis publik P5.

## Melaporkan bug baru

Buka issue dengan template bug: versi + OS + mode (native/web-preview) +
langkah reproduksi + ekspektasi vs realita + log (tab Log / `log_path`).
Untuk celah keamanan: **jangan** buka issue publik — lihat `SECURITY.md`.
