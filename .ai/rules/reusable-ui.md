# Reusable UI Rules — DeskPet

Source of truth: PRD §6 (UX), §12 (Design System). P1 scope only.

## Tokens (use CSS variables, never hardcode elsewhere)

`--dp-primary #8174E8`, `--dp-primary-dark #5C50B8`, `--dp-bg #F6F5FB`,
`--dp-surface #FFFFFF`, `--dp-text #22223A`, `--dp-muted #77778E`.
Status colors: success `#3F9B78`, warning `#E9A23B`, danger `#D95C69`.

## Component conventions

1. **Location:** `apps/desktop/src/components/<Name>/<Name>.tsx` + `<Name>.test.tsx`.
2. **Props:** typed `interface Props`, destructure, no `any`. Every interactive element has `aria-label`/`role` and `:focus-visible` style.
3. **Drag:** pet window root uses `.dp-drag` (`-webkit-app-region: drag`). All buttons/menus must opt out with `.dp-nodrag` (`no-drag`) so dragging never triggers clicks behind (PRD §5.1).
4. **Motion:** accept `reducedMotion: boolean`; add `.dp-reduced` to disable animation. Also honor `@media (prefers-reduced-motion: reduce)`.
5. **Fallback:** components must render a sane placeholder if assets/IPC fail (P1 PetCanvas renders pure-CSS cat when sprites missing or `invoke` fails → `web-preview` mode).
6. **Tests:** colocated Vitest + Testing Library; assert `data-testid`, `aria-label`, state class. Run `npm test` in `apps/desktop`.

## Current reusables (P1)

- `PetCanvas` (`components/PetCanvas/`) — placeholder character, props `{state, reducedMotion, onTap}`.
- Quick menu pattern in `App.tsx` (toolbar with Hide/Top/Motion/Sleep/Wake) — extract to `components/QuickMenu/` when reused in P2 panels.

## Forbidden in P1

- No network fetches, no telemetry pixels, no global mouse/keyboard listeners (only local `keydown` for Hide/Show shortcut).
- No AI/OAuth/email/plugin UI.
