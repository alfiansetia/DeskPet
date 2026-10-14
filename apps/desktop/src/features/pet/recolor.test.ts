import { describe, expect, it } from "vitest";
import { buildRecolorMap, recolorPixels } from "./recolor";
import { LAVENDER_PALETTE, resolvePalette } from "./palettes";

function px(r: number, g: number, b: number, a = 255): [number, number, number, number] {
  return [r, g, b, a];
}

describe("recolorPixels", () => {
  it("mengganti 4 token body lavender -> preset sky, sisanya utuh", () => {
    const sky = resolvePalette("sky", undefined);
    const map = buildRecolorMap(sky);
    // bodyMain, outline(terkunci), putih mata(terkunci), transparan
    const data = new Uint8ClampedArray([
      ...px(0x8E, 0x82, 0xEB), // bodyMain lavender
      ...px(0x2B, 0x23, 0x53), // outline -> jangan berubah
      ...px(0xFF, 0xFF, 0xFF), // eye-shine putih -> jangan berubah
      ...px(0xEB, 0xE6, 0xFF), // belly
      ...px(0, 0, 0, 0),       // transparan
    ]);
    const changed = recolorPixels(data, map);
    expect(changed).toBe(2);
    // bodyMain -> sky main #6CB8E8
    expect([data[0], data[1], data[2]]).toEqual([0x6C, 0xB8, 0xE8]);
    // outline utuh
    expect([data[4], data[5], data[6]]).toEqual([0x2B, 0x23, 0x53]);
    // putih utuh (belly #EBE6FF tidak boleh menarik #FFFFFF, jarak ~32 > tol 16)
    expect([data[8], data[9], data[10]]).toEqual([0xFF, 0xFF, 0xFF]);
    // belly -> sky belly #EAF6FF
    expect([data[12], data[13], data[14]]).toEqual([0xEA, 0xF6, 0xFF]);
    // alpha transparan tetap 0
    expect(data[19]).toBe(0);
  });

  it("default lavender -> lavender tidak mengubah apa pun secara visual", () => {
    const map = buildRecolorMap(LAVENDER_PALETTE);
    const data = new Uint8ClampedArray([...px(0x8E, 0x82, 0xEB), ...px(0x2B, 0x23, 0x53)]);
    const before = Array.from(data);
    recolorPixels(data, map);
    expect(Array.from(data)).toEqual(before);
  });

  it("toleransi tepi: warna blend dekat body tetap ke-map, warna jauh tidak", () => {
    const sky = resolvePalette("sky", undefined);
    const map = buildRecolorMap(sky);
    // blend 1-step dari bodyMain (0x8E->0x8D): jarak 1 -> ikut
    // abu acak jauh dari semua token -> tidak ikut
    const data = new Uint8ClampedArray([
      ...px(0x8D, 0x82, 0xEB),
      ...px(0x11, 0x22, 0x33),
    ]);
    const changed = recolorPixels(data, map, 16);
    expect(changed).toBe(1);
    expect([data[0], data[1], data[2]]).toEqual([0x6C, 0xB8, 0xE8]);
    expect([data[4], data[5], data[6]]).toEqual([0x11, 0x22, 0x33]);
  });
});
