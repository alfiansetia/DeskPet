# Cat Asset Pack (`deskpet.cat`)

Official character asset pack for DeskPet, crafted in accordance with `DESKPET_PRD.md` (§13 Character Asset Specification).

## Overview
- **Character**: Cat (single recolorable species)
- **Visual Style**: Pastel pixel-art cat with expressive eyes and crisp silhouette. Ships with a lavender/indigo base; alternate palettes (Sky, Matcha, Peach, Rose, Midnight, custom) are applied at runtime.
- **Resolution**: 128x128 px per frame (drawn on a 32x32 pixel grid with 4x crisp nearest-neighbor scaling)
- **Format**: Transparent PNG spritesheets + layered SVG vector source
- **License**: Creative Commons Zero v1.0 Universal (CC0-1.0) Public Domain Dedication

## Default Palette Tokens / base recolor (PRD §12)
- Body Base: `#8E82EB` (Pastel Lavender)
- Highlight: `#C3BBFF` (Soft Lavender Highlight)
- Shadow: `#5C50B8` (Indigo Shadow)
- Outline: `#2B2353` (Dark Indigo Outline)
- Cheeks: `#EB7D96` (Rosy Blush)
- Eyes: `#22223A` (Dark Indigo) with `#FFFFFF` twinkle
- Bell/Accent: `#E9A23B` (Warm Amber)

## Files Included
- `manifest.json`: Metadata & animation frame mappings
- `idle.png`: 4 frames (512x128) - Breathing, ear twitch, blinking
- `walk.png`: 6 frames (768x128) - Walking cycle with stepping paws and swaying tail
- `dragged.png`: 2 frames (256x128) - Airborne state with dangling paws and wide curious eyes
- `jump.png`: 4 frames (512x128) - Crouch, leap, apex with sparkle, landing
- `sleep.png`: 4 frames (512x128) - Cozy sleeping loaf with floating Zzz
- `react.png`: 4 frames (512x128) - Joyful bounce with happy eyes and floating hearts
- `speak.png`: 4 frames (512x128) - Speaking mouth animation with musical note blip
- `attention.png`: 4 frames (512x128) - Alert stance with glowing amber exclamation mark
- `reminder.png`: 4 frames (512x128) - Reminder stance with glowing ringing clock icon
- `preview.png`: 1 frame (128x128) - Standalone character preview/avatar
- `cat.svg`: Layered vector master source file (recolor base)

## Usage
In DeskPet, this pack is loaded by setting `character_id: "deskpet.cat"` plus a palette (`petPaletteId`, e.g. `lavender`, `sky`, `custom`).
If assets fail to load, `PetCanvas` gracefully falls back to the CSS placeholder.
