# Black Cat Asset Pack (`deskpet.cat.black`)

Official character asset pack for DeskPet, crafted in accordance with `DESKPET_PRD.md` (§13 Character Asset Specification).

## Overview
- **Character**: Black Cat (Mystic Slate / Kuro-neko)
- **Visual Style**: Sleek, mysterious pixel-art cat with deep slate-charcoal fur, glowing purple/violet eyes, and crimson collar with golden bell
- **Resolution**: 128x128 px per frame (drawn on a 32x32 pixel grid with 4x crisp nearest-neighbor scaling)
- **Format**: Transparent PNG spritesheets + layered SVG vector source
- **License**: Creative Commons Zero v1.0 Universal (CC0-1.0) Public Domain Dedication

## Palette Tokens
- Body Base: `#2B2D3A` (Deep Slate Charcoal)
- Highlight: `#484B5E` (Cool Slate Highlight)
- Shadow: `#1A1B24` (Pitch Shadow)
- Outline: `#0F1015` (Deep Midnight Outline)
- Cheeks & Inner Ears: `#E283A4` (Soft Pink)
- Eyes: `#9D4EDD` / `#C77DFF` (Mystic Glowing Amethyst) with `#FFFFFF` twinkle
- Collar / Bell: `#E63946` / `#FFD13B` (Crimson & Gold)

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
- `black-cat.svg`: Layered vector master source file

## Usage
In DeskPet, this pack is loaded by setting `characterId: "deskpet.cat.black"`.
If assets fail to load, `PetCanvas` gracefully falls back to the CSS placeholder.
