# Penguin Asset Pack (`deskpet.penguin`)

Official fifth character asset pack for DeskPet, crafted in accordance with `DESKPET_PRD.md` (§13 Character Asset Specification).

## Overview
- **Character**: Penguin / Pinguin (fifth recolorable species)
- **Visual Style**: Cute egg-round pixel-art penguin with wide white belly, round eyes with blush cheeks, small locked-amber triangle beak, side flippers (down/mid/up/wave/spread poses), orange feet, 2px head tuft, and expressive floating icons (Zzz, hearts, !, clock, notes)
- **Walk style**: waddle (lean left-right with swinging flippers and nodding head), unlike the cat's walk, the snake's slither, the frog's hop, and the owl's hop-fly
- **Resolution**: 128x128 px per frame (drawn on a 32x32 pixel grid with 4x nearest-neighbor scaling)
- **Format**: Transparent PNG spritesheets + generated SVG vector source
- **License**: Creative Commons Zero v1.0 Universal (CC0-1.0) Public Domain Dedication

## Recolor Contract
Body pixels use the exact same 4 base tokens as cat, snake, frog & owl (`#8E82EB` / `#C3BBFF` / `#5C50B8` / `#EBE6FF`), so every existing palette works on the penguin with zero extra code. Locked colors (outline, eyes, beak/feet amber, blush, icons) never change — the beak and feet use amber `#E9A23B` directly, never a recolor token.

## Files Included
- `manifest.json`: Metadata & animation frame mappings
- `generate.mjs`: Procedural generator (single source of truth — edit art here, then `node generate.mjs --write .`)
- `idle.png`: 4 frames — breathing, flipper sway, blink, beak chirp
- `walk.png`: 6 frames — waddle cycle (lean left-right, flipper swing, head nod)
- `dragged.png`: 2 frames — flippers spread, wide eyes, dangling feet
- `jump.png`: 4 frames — crouch, takeoff, apex (beak open), landing blink
- `sleep.png`: 4 frames — squashed loaf, closed eyes, nodding head, floating Zzz
- `react.png`: 4 frames — happy bounce with hearts
- `speak.png`: 4 frames — beak open/half with music-note blip
- `attention.png`: 4 frames — stretch pose with wide eyes and amber `!`
- `reminder.png`: 4 frames — idle pose with amber clock icon
- `preview.png`: 1 frame (128x128) - Standalone character preview/avatar
- `penguin.svg`: Generated vector master (from idle frame 0)

## Regenerating
```bash
cd assets/characters/penguin
node generate.mjs --preview   # ASCII check in terminal
node generate.mjs --write .   # rewrite PNGs + SVG
# then sync the runtime copy:
cp *.png penguin.svg manifest.json ../../../apps/desktop/public/assets/characters/penguin/
```

## Usage
In DeskPet, select species `penguin` (settings `petSpecies`), plus a palette (`petPaletteId`).
If assets fail to load, `PetCanvas` gracefully falls back to the CSS placeholder.
