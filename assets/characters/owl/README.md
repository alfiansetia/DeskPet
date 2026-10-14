# Owl Asset Pack (`deskpet.owl`)

Official fourth character asset pack for DeskPet, crafted in accordance with `DESKPET_PRD.md` (§13 Character Asset Specification).

## Overview
- **Character**: Owl / Burung Hantu (fourth recolorable species)
- **Visual Style**: Cute round pixel-art owl with ear tufts, big double eyes with bright rings, small locked-amber beak, side wings, tiny feet, and expressive floating icons (Zzz, hearts, !, clock, notes)
- **Walk style**: hop-fly (crouch → wings-up launch → spread-wing glide → landing), unlike the cat's walk, the snake's slither, and the frog's hop
- **Resolution**: 128x128 px per frame (drawn on a 32x32 pixel grid with 4x nearest-neighbor scaling)
- **Format**: Transparent PNG spritesheets + generated SVG vector source
- **License**: Creative Commons Zero v1.0 Universal (CC0-1.0) Public Domain Dedication

## Recolor Contract
Body pixels use the exact same 4 base tokens as cat, snake & frog (`#8E82EB` / `#C3BBFF` / `#5C50B8` / `#EBE6FF`), so every existing palette works on the owl with zero extra code. Locked colors (outline, eyes, beak/feet amber, blush, icons) never change — the beak and feet use amber `#E9A23B` directly, never a recolor token.

## Files Included
- `manifest.json`: Metadata & animation frame mappings
- `generate.mjs`: Procedural generator (single source of truth — edit art here, then `node generate.mjs --write .`)
- `idle.png`: 4 frames — breathing, blink, head-tilt
- `walk.png`: 6 frames — hop-fly cycle (crouch, wings-up, spread glide, landing)
- `dragged.png`: 2 frames — wings spread, wide eyes
- `jump.png`: 4 frames — crouch, takeoff, apex (beak open), landing blink
- `sleep.png`: 4 frames — tucked loaf, closed eyes, nodding head, floating Zzz
- `react.png`: 4 frames — happy bounce with hearts
- `speak.png`: 4 frames — beak open/half with music-note blip
- `attention.png`: 4 frames — stretch pose with wide eyes and amber `!`
- `reminder.png`: 4 frames — idle pose with amber clock icon
- `preview.png`: 1 frame (128x128) - Standalone character preview/avatar
- `owl.svg`: Generated vector master (from idle frame 0)

## Regenerating
```bash
cd assets/characters/owl
node generate.mjs --preview   # ASCII check in terminal
node generate.mjs --write .   # rewrite PNGs + SVG
# then sync the runtime copy:
cp *.png owl.svg manifest.json ../../../apps/desktop/public/assets/characters/owl/
```

## Usage
In DeskPet, select species `owl` (settings `petSpecies`), plus a palette (`petPaletteId`).
If assets fail to load, `PetCanvas` gracefully falls back to the CSS placeholder.
