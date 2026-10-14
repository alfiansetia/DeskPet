# Testing — P1

## Rust (`apps/desktop/src-tauri`)

```sh
cargo test
```

atau dari `apps/desktop` (tanpa `cd`):

```sh
npm run test:rust   # cargo test via --manifest-path
npm run test:all    # vitest + cargo test sekaligus
```

- `pet::state`: all 8 PRD states parse, unknown rejected, drag-from-any, sleep-exit constrained, transient flags.
- `db`: foundation tables exist, migration idempotent, file roundtrip persists, bad `status` rejected by CHECK.
- `settings`: defaults local-first (`telemetry=false`), enabling telemetry rejected, empty character rejected.

## Frontend (`apps/desktop`)

```sh
npm install
npm test        # vitest run
npm run build   # tsc --noEmit + vite build (typecheck)
```

> Windows note: `vite.config.ts` ignores `src-tauri/target/**` in `server.watch`,
> otherwise Vite crashes with `EBUSY ... build_script_build-*.exe` during `tauri dev`.
> Run Rust tests from `apps/desktop/src-tauri` (`cargo test`), not from `apps/desktop`.

- `petStateMachine.test.ts`: 8 states, rejection, frame table, transition mirror.
- `PetCanvas.test.tsx`: renders state label, reduced-motion class.
- `storage.test.ts`: fallback on missing/corrupt data.

## Known platform limitations (P1, not silently pretended)

- Tray icon needs PNG assets (`src-tauri/icons/*`): build currently references placeholder paths; `tray init failed` is non-fatal and logged. Add real icons before P5 release.
- Click-through-when-idle (`setIgnoreCursorEvents`) is behind a setting but not wired to a command yet (needs per-platform testing on Win/macOS).
- Multi-monitor/DPI/sleep-wake/notification/TTS tests belong to P2/P5; P1 only smoke-tests drag + hide/show + always-on-top toggle.
- `cargo test` does not cover actual transparent-window rendering; that requires manual `tauri dev` smoke on both OSes.
