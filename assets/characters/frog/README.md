# Frog Asset Pack (`deskpet.frog`)

Official third character asset pack for DeskPet, crafted in accordance with `DESKPET_PRD.md` (§13 Character Asset Specification).

## Overview
- **Character**: Frog / Kodok (third recolorable species)
- **Visual Style**: Cute squat pixel-art frog with double eye bumps, wide smile, blush cheeks, spotted back, folded thighs, and expressive floating icons (Zzz, hearts, !, clock, notes)
- **Walk style**: hops (crouch → launch → airborne → landing), unlike the cat's walk and the snake's slither
- **Resolution**: 128x128 px per frame (drawn on a 32x32 pixel grid with 4x nearest-neighbor scaling)
- **Format**: Transparent PNG spritesheets + generated SVG vector source
- **License**: Creative Commons Zero v1.0 Universal (CC0-1.0) Public Domain Dedication

## Recolor Contract
Body pixels use the exact same 4 base tokens as cat & snake (`#8E82EB` / `#C3BBFF` / `#5C50B8` / `#EBE6FF`), so every existing palette works on the frog with zero extra code. Locked colors (outline, eyes, tongue, blush, amber icons) never change.

## Files Included
- `manifest.json`: Metadata & animation frame mappings
- `generate.mjs`: Procedural generator (single source of truth — edit art here, then `node generate.mjs --write .`)
- `idle.png`: 4 frames — breathing, blink, tongue flick
- `walk.png`: 6 frames — hop cycle (crouch, launch, airborne, landing)
- `dragged.png`: 2 frames — stretched airborne, dangling legs, wide eyes
- `jump.png`: 4 frames — deep crouch, big launch, apex, landing blink
- `sleep.png`: 4 frames — flattened loaf, closed eyes, floating Zzz
- `react.png`: 4 frames — happy bounce with hearts
- `speak.png`: 4 frames — mouth open/half with music-note blip
- `attention.png`: 4 frames — stretched alert pose with amber `!`
- `reminder.png`: 4 frames — idle pose with amber clock icon
- `preview.png`: 1 frame (128x128) - Standalone character preview/avatar
- `frog.svg`: Generated vector master (from idle frame 0)

## Regenerating
```bash
cd assets/characters/frog
node generate.mjs --preview   # ASCII check in terminal
node generate.mjs --write .   # rewrite PNGs + SVG
# then sync the runtime copy:
cp *.png frog.svg manifest.json ../../../apps/desktop/public/assets/characters/frog/
```

## Usage
In DeskPet, select species `frog` (settings `petSpecies`), plus a palette (`petPaletteId`).
If assets fail to load, `PetCanvas` gracefully falls back to the CSS placeholder.
