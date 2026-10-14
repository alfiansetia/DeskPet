# DeskPet — Reusable Rules (source: `.ai/`)

This folder is the **single place** for reusable UI/function conventions.
All new code must follow these rules so features stay consistent and local-first.

- `RULES.md` — global working rules (privacy, Rust-authoritative, tests).
- `rules/reusable-ui.md` — reusable React/UI conventions.
- `rules/reusable-functions.md` — reusable Rust/TS function conventions.

## How to add a reusable piece

1. Put shared React components in `apps/desktop/src/components/<Name>/` with `<Name>.tsx` + `<Name>.test.tsx` + colocated styles in `styles.css` (or `<Name>.css` when large).
2. Put shared TS helpers in `apps/desktop/src/lib/` with `*.test.ts`.
3. Put shared Rust logic in `apps/desktop/src-tauri/src/<domain>/` with `#[cfg(test)]` unit tests.
4. Document the new reusable in the matching `.ai/rules/*.md` file.
5. Never duplicate: search `.ai/` + `src/` first, reuse or extend.
