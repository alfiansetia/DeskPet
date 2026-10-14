# Snake Asset Pack (`deskpet.snake`)

Official second character asset pack for DeskPet, crafted in accordance with `DESKPET_PRD.md` (§13 Character Asset Specification).

## Overview
- **Character**: Snake (second recolorable species)
- **Visual Style**: Cute coiled pixel-art snake with big side-view eye, flicking forked tongue, back spots, and expressive floating icons (Zzz, hearts, !, clock, notes)
- **Resolution**: 128x128 px per frame (drawn on a 32x32 pixel grid with 4x nearest-neighbor scaling)
- **Format**: Transparent PNG spritesheets + generated SVG vector source
- **License**: Creative Commons Zero v1.0 Universal (CC0-1.0) Public Domain Dedication

## Recolor Contract
Body pixels use the exact same 4 base tokens as the cat (`#8E82EB` / `#C3BBFF` / `#5C50B8` / `#EBE6FF`), so every cat palette (Sky, Matcha, Peach, Rose, Midnight, custom) works on the snake with zero extra code. Locked colors (outline, eyes, tongue, blush, amber icons) never change.

## Files Included
- `manifest.json`: Metadata & animation frame mappings
- `generate.mjs`: Procedural generator (single source of truth — edit art here, then `node generate.mjs --write .`)
- `idle.png`: 4 frames — breathing, tongue flick, blink
- `walk.png`: 6 frames — slither wave (coil sways, head counter-bobs)
- `dragged.png`: 2 frames — stretched airborne, wide eyes, long tongue
- `jump.png`: 4 frames — crouch, rise, apex stretch, landing blink
- `sleep.png`: 4 frames — tucked coil, closed eyes, floating Zzz
- `react.png`: 4 frames — happy bounce with hearts
- `speak.png`: 4 frames — mouth open/half with music-note blip
- `attention.png`: 4 frames — upright alert pose with amber `!`
- `reminder.png`: 4 frames — upright pose with amber clock icon
- `preview.png`: 1 frame (128x128) - Standalone character preview/avatar
- `snake.svg`: Generated vector master (from idle frame 0)

## Regenerating
```bash
cd assets/characters/snake
node generate.mjs --preview   # ASCII check in terminal
node generate.mjs --write .   # rewrite PNGs + SVG
# then sync the runtime copy:
cp *.png snake.svg manifest.json ../../../apps/desktop/public/assets/characters/snake/
```

## Usage
In DeskPet, select species `snake` (settings `petSpecies`), plus a palette (`petPaletteId`).
If assets fail to load, `PetCanvas` gracefully falls back to the CSS placeholder.
