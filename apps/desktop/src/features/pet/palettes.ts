/** Palette system for the recolorable Lavender Cat base (PRD §13).
 *
 * 1 spesies (kucing) + N palette, bukan N duplikat folder.
 * PNG spritesheet lavender dipakai sebagai basis; piksel flat-fill
 * body di-recolor runtime via `recolor.ts`. Warna terkunci
 * (outline, mata, kalung, efek) tidak ikut berubah.
 */

/** Token warna body yang boleh di-recolor (hex persis dari cat.svg). */
export const LAVENDER_SOURCE = {
  bodyMain: "#8E82EB",
  bodyLight: "#C3BBFF",
  bodyShadow: "#5C50B8",
  belly: "#EBE6FF",
} as const;

export interface CatPalette {
  id: string;
  name: string;
  bodyMain: string;
  bodyLight: string;
  bodyShadow: string;
  belly: string;
}

export const LAVENDER_PALETTE: CatPalette = {
  id: "lavender",
  name: "Lavender",
  bodyMain: LAVENDER_SOURCE.bodyMain,
  bodyLight: LAVENDER_SOURCE.bodyLight,
  bodyShadow: LAVENDER_SOURCE.bodyShadow,
  belly: LAVENDER_SOURCE.belly,
};

/** Preset turunan yang di-tune manual agar kontras tetap enak. */
export const CAT_PALETTES: CatPalette[] = [
  LAVENDER_PALETTE,
  { id: "sky", name: "Sky", bodyMain: "#6CB8E8", bodyLight: "#BEE3FA", bodyShadow: "#3E7FB5", belly: "#EAF6FF" },
  { id: "matcha", name: "Matcha", bodyMain: "#7CB86B", bodyLight: "#C4E8B8", bodyShadow: "#4A8A44", belly: "#EFF9E8" },
  { id: "peach", name: "Peach", bodyMain: "#F0A35C", bodyLight: "#FFD9AE", bodyShadow: "#C87830", belly: "#FFF6E8" },
  { id: "rose", name: "Rose", bodyMain: "#E87FA0", bodyLight: "#F9C2D4", bodyShadow: "#B54A6E", belly: "#FFEDF3" },
  { id: "midnight", name: "Midnight", bodyMain: "#4A4A5E", bodyLight: "#6B6B80", bodyShadow: "#2D2D3D", belly: "#8A8A9E" },
];

export const CUSTOM_PALETTE_ID = "custom";

/* ---------- color utils ---------- */

export function isValidHex(hex: string): boolean {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(hex.trim());
}

/** Normalisasi ke bentuk #RRGGBB uppercase. Invalid -> fallback "#8E82EB". */
export function normalizeHex(hex: string, fallback = LAVENDER_SOURCE.bodyMain): string {
  const t = hex.trim();
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(t);
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return ("#" + h.toUpperCase());
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = normalizeHex(hex);
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60) % 360, s * 100, l * 100];
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.min(100, Math.max(0, s)) / 100;
  l = Math.min(100, Math.max(0, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Turunkan 1 warna dasar user menjadi 4 token body yang harmonis.
 * Light/shadow/belly dihitung dari HSL agar shading pixel-art tetap masuk akal.
 */
export function derivePalette(baseHex: string, id = CUSTOM_PALETTE_ID, name = "Custom"): CatPalette {
  const [r, g, b] = hexToRgb(baseHex);
  const [h, s0, l0] = rgbToHsl(r, g, b);
  const s = clamp(s0, 30, 85);
  const l = clamp(l0, 35, 70);
  return {
    id,
    name,
    bodyMain: hslToHex(h, s, l),
    bodyLight: hslToHex(h, Math.max(20, s - 12), Math.min(90, l + 26)),
    bodyShadow: hslToHex(h, Math.min(95, s + 8), Math.max(16, l - 22)),
    belly: hslToHex(h, Math.min(s, 30) * 0.5, 93),
  };
}

/* ---------- resolve ---------- */

export function getPreset(id: string | undefined): CatPalette | undefined {
  return CAT_PALETTES.find((p) => p.id === id);
}

/**
 * Resolve palette final dari settings. Selalu kembalikan palette valid
 * (fallback lavender) agar renderer tidak pernah crash karena data korup.
 */
export function resolvePalette(paletteId: string | undefined, customColor: string | undefined): CatPalette {
  if (paletteId === CUSTOM_PALETTE_ID && customColor && isValidHex(customColor)) {
    return derivePalette(customColor);
  }
  return getPreset(paletteId) ?? LAVENDER_PALETTE;
}

/** True bila palette == lavender default -> renderer boleh pakai PNG asli (tanpa recolor). */
export function isDefaultPalette(p: CatPalette): boolean {
  return (
    p.id === LAVENDER_PALETTE.id &&
    normalizeHex(p.bodyMain) === LAVENDER_SOURCE.bodyMain &&
    normalizeHex(p.bodyLight) === LAVENDER_SOURCE.bodyLight &&
    normalizeHex(p.bodyShadow) === LAVENDER_SOURCE.bodyShadow &&
    normalizeHex(p.belly) === LAVENDER_SOURCE.belly
  );
}
