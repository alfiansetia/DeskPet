import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { clamp, edgeStepRange, fleeTargetFor, nearestEdge, nearestPointOnEdge, previewBounds, randomPointOnEdge, shouldCenterPet, sideOf, spritePads, tauriBounds, useWander, type EdgeIndex } from "./useWander";

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
    expect(spritePads(160, 168, null)).toEqual({ padL: 16, padR: 16, padT: 16, padB: 16 });
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

describe("edges mode (keliling tepi layar)", () => {
  const b = { minX: 0, maxX: 1000, minY: 0, maxY: 500 };

  it("nearestEdge: tepi terdekat dari posisi", () => {
    expect(nearestEdge(500, 10, b)).toBe(0); // dekat atas
    expect(nearestEdge(990, 250, b)).toBe(1); // dekat kanan
    expect(nearestEdge(500, 490, b)).toBe(2); // dekat bawah
    expect(nearestEdge(10, 250, b)).toBe(3); // dekat kiri
    expect(nearestEdge(500, 250, b)).toBe(0); // tengah: seri -> atas (urutan cek)
  });

  it("randomPointOnEdge: titik selalu mentok di tepinya", () => {
    for (let i = 0; i < 50; i++) {
      const edge = (i % 4) as EdgeIndex;
      const p = randomPointOnEdge(edge, b);
      if (edge === 0) { expect(p.y).toBe(b.minY); expect(p.x).toBeGreaterThanOrEqual(b.minX); expect(p.x).toBeLessThanOrEqual(b.maxX); }
      if (edge === 1) { expect(p.x).toBe(b.maxX); expect(p.y).toBeGreaterThanOrEqual(b.minY); expect(p.y).toBeLessThanOrEqual(b.maxY); }
      if (edge === 2) { expect(p.y).toBe(b.maxY); expect(p.x).toBeGreaterThanOrEqual(b.minX); expect(p.x).toBeLessThanOrEqual(b.maxX); }
      if (edge === 3) { expect(p.x).toBe(b.minX); expect(p.y).toBeGreaterThanOrEqual(b.minY); expect(p.y).toBeLessThanOrEqual(b.maxY); }
    }
  });

  it("s-range: target dibatasi setengah tepi dekat sudut bersama", () => {
    // Tepi kanan (1): s=0 -> atas (y=0), s=1 -> bawah (y=500).
    // Searah jarum jam (top->right): s di [0, 0.5] -> y di [0, 250].
    const rnd = vi.spyOn(Math, "random");
    try {
      rnd.mockReturnValue(0);
      expect(randomPointOnEdge(1, b, 0, 0.5)).toEqual({ x: 1000, y: 0 });
      expect(randomPointOnEdge(1, b, 0.5, 1)).toEqual({ x: 1000, y: 250 });
      rnd.mockReturnValue(0.9999);
      const p1 = randomPointOnEdge(1, b, 0, 0.5);
      expect(p1.y).toBeGreaterThanOrEqual(0);
      expect(p1.y).toBeLessThanOrEqual(250);
      const p2 = randomPointOnEdge(1, b, 0.5, 1);
      expect(p2.y).toBeGreaterThanOrEqual(250);
      expect(p2.y).toBeLessThanOrEqual(500);
      // Full-range default tetap seluruh tepi.
      const p3 = randomPointOnEdge(2, b);
      expect(p3.y).toBe(500);
      expect(p3.x).toBeGreaterThanOrEqual(0);
      expect(p3.x).toBeLessThanOrEqual(1000);
    } finally {
      rnd.mockRestore();
    }
  });

  it("langkah sudut: titik tengah garis tetap di kuadran sudut", () => {
    // Dari tengah tepi atas (500,0) ke setengah-atas tepi kanan (x=1000,
    // y<=250): titik tengah garis selalu di kuadran kanan-atas
    // (x>=500, y<=250) — periferi, bukan tengah layar.
    const from = { x: 500, y: b.minY };
    for (let i = 0; i < 50; i++) {
      const t = randomPointOnEdge(1, b, 0, 0.5);
      const mid = { x: (from.x + t.x) / 2, y: (from.y + t.y) / 2 };
      expect(mid.x).toBeGreaterThanOrEqual(500);
      expect(mid.y).toBeLessThanOrEqual(125);
    }
  });

  it("nearestPointOnEdge: proyeksi mentok ke tepinya", () => {
    expect(nearestPointOnEdge(500, 250, b, 0)).toEqual({ x: 500, y: 0 });
    expect(nearestPointOnEdge(500, 250, b, 1)).toEqual({ x: 1000, y: 250 });
    expect(nearestPointOnEdge(500, 250, b, 2)).toEqual({ x: 500, y: 500 });
    expect(nearestPointOnEdge(500, 250, b, 3)).toEqual({ x: 0, y: 250 });
    // di-clamp bila di luar bounds
    expect(nearestPointOnEdge(9999, 9999, b, 0)).toEqual({ x: 1000, y: 0 });
  });

  it("edgeStepRange: searah=[0,0.5], mundur=[0.5,1]", () => {
    expect(edgeStepRange(1)).toEqual({ sMin: 0, sMax: 0.5 });
    expect(edgeStepRange(3)).toEqual({ sMin: 0.5, sMax: 1 });
  });

  it("kaki s-range steady-state tidak pernah masuk kotak tengah", () => {
    // Kotak tengah = sepertiga tengah layar. Kaki keliling antar tepi
    // bersebelahan dengan s-range harus selalu di periferi.
    const cx0 = 1000 / 3, cx1 = (1000 * 2) / 3, cy0 = 500 / 3, cy1 = (500 * 2) / 3;
    const hitsCenter = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
      for (let i = 0; i <= 20; i++) {
        const x = p1.x + ((p2.x - p1.x) * i) / 20;
        const y = p1.y + ((p2.y - p1.y) * i) / 20;
        if (x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1) return true;
      }
      return false;
    };
    for (let cur = 0; cur < 4; cur++) {
      for (const step of [1, 3] as const) {
        const next1 = ((cur + step) % 4) as EdgeIndex;
        const next2 = ((next1 + step) % 4) as EdgeIndex;
        const { sMin, sMax } = edgeStepRange(step);
        for (let i = 0; i < 25; i++) {
          const pos = randomPointOnEdge(cur as EdgeIndex, b);
          const t1 = randomPointOnEdge(next1, b, sMin, sMax);
          const t2 = randomPointOnEdge(next2, b, sMin, sMax);
          expect(hitsCenter(pos, t1)).toBe(false);
          expect(hitsCenter(t1, t2)).toBe(false);
        }
      }
    }
  });
});
describe("fleeTargetFor (pet pemalu kabur)", () => {
  const b = { minX: 0, maxX: 1000, minY: 0, maxY: 500 };

  it("menjauhi arah kursor sejauh dist", () => {
    // Kursor di kanan-atas pet -> kabur ke kiri-bawah.
    const t = fleeTargetFor({ x: 500, y: 250 }, { dx: -1, dy: 1 }, b, 240);
    expect(t).toEqual({ x: 260, y: 490 });
  });

  it("di-clamp ke bounds, tidak keluar layar", () => {
    const t = fleeTargetFor({ x: 900, y: 250 }, { dx: 1, dy: 0 }, b, 240);
    expect(t.x).toBe(1000); // mentok kanan
    expect(t.y).toBe(250);
  });

  it("terjepit sudut: menyusuri sumbu yang lega, bukan diam", () => {
    // Di pojok kanan-atas, disuruh kabur ke kanan-atas (buntu).
    const t = fleeTargetFor({ x: 1000, y: 0 }, { dx: 1, dy: -1 }, b, 240);
    expect(Math.hypot(t.x - 1000, t.y - 0)).toBeGreaterThanOrEqual(40);
    expect(t.x).toBeGreaterThanOrEqual(b.minX);
    expect(t.x).toBeLessThanOrEqual(b.maxX);
    expect(t.y).toBeGreaterThanOrEqual(b.minY);
    expect(t.y).toBeLessThanOrEqual(b.maxY);
  });

  it("tanpa arah: diam di tempat (tidak crash)", () => {
    const p = { x: 500, y: 250 };
    const t = fleeTargetFor(p, { dx: 0, dy: 0 }, b, 240);
    expect(t.x).toBeGreaterThanOrEqual(b.minX);
    expect(t.x).toBeLessThanOrEqual(b.maxX);
  });
});
describe("shouldCenterPet (fokus alert ke tengah)", () => {
  it("aktif default; mati bila user mematikan / panel terbuka", () => {
    expect(shouldCenterPet(true, false)).toBe(true);
    expect(shouldCenterPet(undefined, false)).toBe(true); // simpanan lama
    expect(shouldCenterPet(false, false)).toBe(false);
    expect(shouldCenterPet(true, true)).toBe(false);
    expect(shouldCenterPet(false, true)).toBe(false);
  });
});

describe("sideOf (menoleh ke kursor)", () => {
  it("kanan -> 1 (default), kiri -> -1, tepat tengah -> 1", () => {
    expect(sideOf(200, 100)).toBe(1);
    expect(sideOf(50, 100)).toBe(-1);
    expect(sideOf(100, 100)).toBe(1);
  });
});

describe("centerPet (preview fallback)", () => {
  it("selalu resolve + offset kembali ke tengah tanpa backend", async () => {
    const { result } = renderHook(() =>
      useWander({ enabled: false, petState: "idle", reducedMotion: false, paused: true, requestState: () => {} })
    );
    await act(async () => { await result.current.centerPet(); });
    expect(result.current.offset).toEqual({ x: 0, y: 0 });
  });
});
