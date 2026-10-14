# DeskPet — P1 Foundation (local-first desktop companion)

> PRD: [`DESKPET_PRD.md`](./DESKPET_PRD.md) is the source of truth. P1 exit criteria: *a movable animated character runs on both target platforms.*

## Layout

```text
apps/desktop/              # Tauri 2 + React + TS app
  src/                     # PetCanvas, pet state machine, App, styles
  src-tauri/               # Rust: pet/db/settings/commands, tray, window
assets/characters/         # lavender-cat placeholder manifest (CSS art in P1)
docs/                      # architecture, build-windows-macos, privacy, testing
.ai/                       # reusable UI/function rules
```

## Quickstart

```sh
cd apps/desktop
npm install
npm test            # frontend tests
npm run tauri dev   # pet window + tray
cargo test          # Rust tests (in src-tauri)
```

See `docs/build-windows-macos.md` for Windows/macOS bundles.

## Privacy

Local-first, telemetry off, no sensitive actions without permission. See `docs/privacy.md`.
P1 omits AI, OAuth, email/calendar, dynamic plugins — by design.
