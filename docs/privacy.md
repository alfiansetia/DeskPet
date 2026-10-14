# Privacy — P1 Guarantees (PRD §9)

- **Local-first:** pet window, state machine, settings, SQLite all work offline. `app_health` reports `networkRequired:false`.
- **No telemetry by default:** no telemetry code exists; `AppSettings.telemetry_enabled` defaults `false` and `validate()` rejects `true` in P1.
- **No sensitive capture:** no screenshots, keylogging, clipboard, global input hooks. Only local `keydown` for the Hide/Show shortcut.
- **No sensitive actions without permission:** P1 has no external writes, no shell, no AI. Future actions require preview + explicit confirmation (see PRD §5.7 policy table).
- **Secrets:** none in P1. Rule: never store tokens in SQLite plaintext; use OS credential storage (enforced from P4).
- **Logs:** Rust logs only non-sensitive init errors to stderr (`[deskpet] ...`); never note bodies/prompts.
