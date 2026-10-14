# Orange Cat Asset Pack (`deskpet.cat.orange`)

Official character asset pack for DeskPet, crafted in accordance with `DESKPET_PRD.md` (§13 Character Asset Specification).

## Overview
- **Character**: Orange Cat (Ginger Tabby)
- **Visual Style**: Warm and cheerful pixel-art cat with golden-orange tones, cream belly, amber eyes, and cyan collar
- **Resolution**: 128x128 px per frame (drawn on a 32x32 pixel grid with 4x crisp nearest-neighbor scaling)
- **Format**: Transparent PNG spritesheets + layered SVG vector source
- **License**: Creative Commons Zero v1.0 Universal (CC0-1.0) Public Domain Dedication

## Palette Tokens
- Body Base: `#E8833A` (Warm Amber Orange)
- Highlight: `#F5B06B` (Soft Apricot Gold)
- Shadow: `#B8551B` (Deep Terracotta Shadow)
- Outline: `#522108` (Deep Chocolate Brown Outline)
- Cheeks & Inner Ears: `#F8A4B8` (Rosy Peach)
- Muzzle / Belly: `#FFF2DD` (Cream White)
- Eyes: `#D47A0E` (Amber Hazel) with `#FFFFFF` twinkle
- Collar / Bell: `#2AC5D4` / `#FFD13B` (Vibrant Cyan & Gold)

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
- `orange-cat.svg`: Layered vector master source file

## Usage
In DeskPet, this pack is loaded by setting `characterId: "deskpet.cat.orange"`.
If assets fail to load, `PetCanvas` gracefully falls back to the CSS placeholder.
