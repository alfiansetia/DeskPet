## Ringkasan

<!-- Apa yang berubah dan kenapa -->

## Cara mengetes

```bash
cd apps/desktop
npm test && npm run test:rust
npx tsc --noEmit
```

- [ ] `npm test` hijau
- [ ] `npm run test:rust` hijau
- [ ] `tsc --noEmit` hijau
- [ ] Smoke `tauri dev` (bila menyentuh UI/window/tray)

## Dampak privasi

<!-- Network baru? Data baru? Izin baru? Tulis "tidak ada" bila nihil. -->

## Screenshot (bila UI berubah)

## Checklist

- [ ] Test baru/diubah menyertai perubahan perilaku
- [ ] Docs diperbarui (`README.md` / `docs/*` / `CHANGELOG.md` bila perlu)
- [ ] Tanpa secret/kunci yang ikut ter-commit
