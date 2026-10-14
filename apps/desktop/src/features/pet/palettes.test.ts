import { describe, expect, it } from "vitest";
import {
  CAT_PALETTES,
  derivePalette,
  getPreset,
  isDefaultPalette,
  isValidHex,
  LAVENDER_PALETTE,
  normalizeHex,
  resolvePalette,
} from "./palettes";

describe("palettes", () => {
  it("lavender preset cocok dengan hex SVG asli", () => {
    expect(LAVENDER_PALETTE.bodyMain).toBe("#8E82EB");
    expect(LAVENDER_PALETTE.bodyLight).toBe("#C3BBFF");
    expect(LAVENDER_PALETTE.bodyShadow).toBe("#5C50B8");
    expect(LAVENDER_PALETTE.belly).toBe("#EBE6FF");
    expect(isDefaultPalette(LAVENDER_PALETTE)).toBe(true);
  });

  it("semua preset punya 4 hex valid yang berbeda", () => {
    for (const p of CAT_PALETTES) {
      for (const k of ["bodyMain", "bodyLight", "bodyShadow", "belly"] as const) {
        expect(isValidHex(p[k])).toBe(true);
      }
      const uniq = new Set([p.bodyMain, p.bodyLight, p.bodyShadow, p.belly]);
      expect(uniq.size).toBe(4);
      if (p.id !== "lavender") expect(isDefaultPalette(p)).toBe(false);
    }
  });

  it("resolvePalette fallback ke lavender untuk id asing/korup", () => {
    expect(resolvePalette("ngaco", undefined).id).toBe("lavender");
    expect(resolvePalette(undefined, undefined).id).toBe("lavender");
    expect(resolvePalette("custom", "bukan-warna").id).toBe("lavender");
  });

  it("derivePalette dari 1 warna custom menghasilkan 4 token harmonis", () => {
    const p = derivePalette("#3E9B4F");
    expect(p.id).toBe("custom");
    for (const k of ["bodyMain", "bodyLight", "bodyShadow", "belly"] as const) {
      expect(isValidHex(p[k])).toBe(true);
    }
    const uniq = new Set([p.bodyMain, p.bodyLight, p.bodyShadow, p.belly]);
    expect(uniq.size).toBe(4);
  });

  it("custom resolve hanya bila hex valid", () => {
    const p = resolvePalette("custom", "#3E9B4F");
    expect(p.id).toBe("custom");
    expect(getPreset("sky")?.name).toBe("Sky");
  });

  it("normalizeHex menangani #rgb dan menolak invalid", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("#8e82eb")).toBe("#8E82EB");
    expect(normalizeHex("ngaco")).toBe("#8E82EB");
  });
});
