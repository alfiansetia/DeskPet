import { describe, expect, it } from "vitest";
import { clamp, previewBounds, spritePads, tauriBounds } from "./useWander";

describe("wander bounds (mentok tepi)", () => {
  it("clamp membatasi nilai ke rentang", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it("spritePads mengukur padding dari rect terhadap viewport", () => {
    // viewport 330x274, sprite 128x128 di tengah horizontal, 136px dari atas
    const r = { left: 101, top: 136, right: 229, bottom: 264 };
    expect(spritePads(330, 274, r)).toEqual({ padL: 101, padR: 101, padT: 136, padB: 10 });
    expect(spritePads(220, 220, null)).toEqual({ padL: 46, padR: 46, padT: 46, padB: 46 });
  });

  it("tauriBounds: sprite MENTOK atas + atas taskbar di monitor utama", () => {
    // Layar 1920x1080, taskbar 48px -> work-area bawah = 1032
    const pads = { padL: 101, padR: 101, padT: 136, padB: 10 };
    const b = tauriBounds(0, 0, 1920, 1080, 330, 274, pads, 1,
      { left: 0, top: 0, right: 1920, bottom: 1032 });
    expect(b.minX).toBe(-101);
    expect(b.maxX).toBe(1691);
    expect(b.minY).toBe(-136);
    expect(b.maxY).toBe(768);
    // tepi sprite tepat di tepi work-area (mentok, tanpa gap)
    expect(b.minX + pads.padL).toBe(0); // kiri
    expect(b.maxX + 330 - pads.padR).toBe(1920); // kanan
    expect(b.minY + pads.padT).toBe(0); // atas
    expect(b.maxY + 274 - pads.padB).toBe(1032); // bawah = atas taskbar
  });

  it("tauriBounds: taskbar atas (availTop) membuat atas mentok di bawah taskbar", () => {
    const pads = { padL: 46, padR: 46, padT: 46, padB: 46 };
    const b = tauriBounds(0, 0, 1920, 1080, 220, 220, pads, 1,
      { left: 0, top: 40, right: 1920, bottom: 1080 });
    expect(b.minY + pads.padT).toBe(40);
    expect(b.maxY + 220 - pads.padB).toBe(1080);
  });

  it("tauriBounds: fallback tanpa work-area tetap mengecualikan taskbar 48px", () => {
    const pads = { padL: 46, padR: 46, padT: 46, padB: 46 };
    const b = tauriBounds(0, 0, 1920, 1080, 220, 220, pads, 1, null);
    expect(b.maxY + 220 - pads.padB).toBe(1080 - 48);
    expect(b.minY + pads.padT).toBe(0);
  });

  it("tauriBounds: monitor sekunder tanpa taskbar mentok sampai bawah layar", () => {
    const pads = { padL: 46, padR: 46, padT: 46, padB: 46 };
    const mon = { left: 1920, top: 0, right: 3840, bottom: 1080 };
    const b = tauriBounds(1920, 0, 1920, 1080, 220, 220, pads, 1, mon);
    expect(b.minX + pads.padL).toBe(1920);
    expect(b.maxX + 220 - pads.padR).toBe(3840);
    expect(b.minY + pads.padT).toBe(0);
    expect(b.maxY + 220 - pads.padB).toBe(1080); // tanpa potongan taskbar
  });

  it("tauriBounds: scale 1.5 (DPI) tetap mentok presisi", () => {
    const scale = 1.5;
    const pads = { padL: 50, padR: 50, padT: 60, padB: 12 };
    const monW = 2880, monH = 1620; // 1920x1080 @150%
    const winW = Math.round(220 * scale), winH = Math.round(236 * scale);
    const taskbar = 48 * scale;
    const b = tauriBounds(0, 0, monW, monH, winW, winH, pads, scale,
      { left: 0, top: 0, right: monW, bottom: monH - taskbar });
    expect(b.minY + Math.round(pads.padT * scale)).toBe(0);
    expect(b.maxY + winH - Math.round(pads.padB * scale)).toBe(Math.round(monH - taskbar));
  });

  it("previewBounds: sprite (bukan titik tengah) yang mentok + margin", () => {
    const b = previewBounds(800, 600, 64, 64, 4);
    expect(b.minX).toBe(-332);
    expect(b.maxX).toBe(332);
    expect(b.minY).toBe(-232);
    expect(b.maxY).toBe(232);
    // tepi sprite tepat margin dari tepi viewport
    expect(b.minX - (-400 + 64)).toBe(4);
    expect(b.maxX - (400 - 64)).toBe(-4);
    expect(b.minY - (-300 + 64)).toBe(4);
    expect(b.maxY - (300 - 64)).toBe(-4);
  });
});
