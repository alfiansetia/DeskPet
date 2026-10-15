# Testing

## Perintah

```bash
cd apps/desktop
npm test          # Vitest frontend (run sekali)
npm run test:watch# Vitest watch mode
npm run test:rust # cargo test backend (via --manifest-path)
npm run test:all  # keduanya
npx tsc --noEmit  # typecheck ketat
npm run build     # tsc + vite build
```

> Jalankan tes Rust dari `apps/desktop/src-tauri` (`cargo test`) bila ingin
> langsung; jangan dari `apps/desktop` (masalah lock `target/` di Windows).

## Cakupan backend (`cargo test`, `src-tauri`)

- `pet::state`: 8 state PRD parse; unknown ditolak; drag-dari-mana-saja;
  sleep-exit constrained; transient flags.
- `companions`: registry per-id, validasi ID, tolak hapus `"main"`.
- `db`: tabel fondasi ada; migrasi idempoten (001–003); roundtrip file;
  `CHECK` menolak `status` ilegal.
- `settings`: defaults local-first (`telemetry=false`); mengaktifkan
  telemetri ditolak; character kosong ditolak.
- `actions`: allowlist; `shell.exec` + payload malformed ditolak; audit
  hanya metadata.

## Cakupan frontend (Vitest, jsdom)

- `petStateMachine`, `PetCanvas` (label state, reduced-motion),
  `storage` (fallback data korup), `time` (parse durasi + tanggal natural),
  `parser` (reminder/todo/note/timer/query/kalender/snooze/hapus/selesai/
  cari/ntfy + validasi batas), `store` (backup v2, companions, automations),
  `weather`, `prayer` (countdown, dedup, cache), `companions`,
  `useWander`, `species/palettes/recolor/hats/greetings/care`,
  `calendar`, `apiwatch`, `autostart`, `updater`, `timerShared`,
  `taskNudge`, `petWindow`, `windowFit`, `useWindowHover`,
  `sharedData`, `sfx`, `Bubble`, `Icon`, `MainPanel.*` (tabs, groups,
  companions, calendar, log, logfile, about, assistant), `App.*`
  (pet, alert, prayer, temp, restore).
- `App.tsx` shell sendiri diuji lewat efek yang bisa diamati
  (scheduler tick murni, routing presenter, restore companions).

## Yang harus manual (tidak bisa diunit-test)

- Render window transparan asli + drag OS + always-on-top + click-through.
- Multi-monitor/DPI/sleep-wake/notifikasi OS/TTS asli.
- Installer/upgrade/uninstall (`msi`/`nsis`/`dmg`/`app`).
- `tauri build` di tiap OS target sebelum klaim rilis.
- Tray icon butuh aset PNG asli (`src-tauri/icons/*`); `tray init failed`
  non-fatal dan ter-log — ganti placeholder + tambah `icon.icns` sebelum P5.

## Menambah test baru

1. Logika murni → unit test berdampingan (`*.test.ts(x)`).
2. Efek Tauri (invoke/listen/emit/window) → mock di `vitest.setup.ts` /
   per-file; uji cabang fallback web-preview.
3. Rust baru → `#[cfg(test)]` di modulnya; input jahat harus ditolak.
4. Jalankan `npm run test:all` + `npx tsc --noEmit` sebelum push.

## Laporan terakhir

Lihat `docs/p1-report.md` (fondasi) dan `docs/p2-report.md` (inti lokal).
Keduanya mencatat hasil test saat ditulis; angka pastinya akan bertambah
seiring test baru — perintah di atas adalah kebenaran berjalan.
