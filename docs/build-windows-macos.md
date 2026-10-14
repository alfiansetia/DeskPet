# Build — Windows & macOS (P1)

## Prereqs

- Rust stable (≥1.77, tested 1.99) + Tauri 2 system deps
  - Windows: WebView2 (preinstalled on Win10/11), Visual Studio Build Tools (MSVC)
  - macOS: Xcode CLT (`xcode-select --install`), Rust `aarch64-apple-darwin` / `x86_64-apple-darwin` targets
- Node 20+ / npm 10+

## Dev

```sh
cd apps/desktop
npm install
npm run tauri dev
```

Transparent pet window (220×220) appears; tray icon with Show/Hide/Toggle-top/Quit.

## Production bundles

```sh
cd apps/desktop
npm run tauri build
```

| OS | Output | Notes |
|---|---|---|
| Windows 10/11 (min `10.0.17763.0`) | `src-tauri/target/release/bundle/{msi,nsis}/` | WebView2 required on target |
| macOS 11+ (`macOS.minimumSystemVersion 11.0`) | `.../bundle/{dmg,app}/` | Sign/notarize before distribution (P5) |

Frontend-only preview (no Rust): `npm run dev` → `http://localhost:1420`, badge shows `web-preview`.

## Smoke test

1. Pet renders, idle bob animation.
2. Drag moves window; state shows `dragged` while pressed.
3. Hide button/tray/left-click toggles; `Ctrl/Cmd+Shift+D` toggles.
4. Restart keeps nothing critical yet (P2 adds reminder persistence UX); DB file created at `<app_local_data>/deskpet.db`.
