import { describe, expect, it, vi, afterEach } from "vitest";
import { petWindowLogicalSize, measurePetContentHeight } from "./petWindow";

describe("petWindowLogicalSize (blocking area dinamis)", () => {
  it("tanpa konten tambahan: window dipeluk ke sprite + breathing", () => {
    // scale 1: 128 + 32 = 160 lebar, +8 = 168 tinggi (dulu 220x236)
    expect(petWindowLogicalSize(1, { alert: false, mini: false, timer: false }))
      .toEqual({ width: 160, height: 168 });
  });

  it("mengecil saat pet diperkecil (blocking ikut kecil)", () => {
    const small = petWindowLogicalSize(0.5, { alert: false, mini: false, timer: false });
    const normal = petWindowLogicalSize(1, { alert: false, mini: false, timer: false });
    expect(small).toEqual({ width: 96, height: 104 });
    expect(small.width).toBeLessThan(normal.width);
    expect(small.height).toBeLessThan(normal.height);
  });

  it("membesar saat alert 200% tapi tetap proporsional sprite", () => {
    expect(petWindowLogicalSize(2, { alert: false, mini: false, timer: false }))
      .toEqual({ width: 288, height: 296 });
  });

  it("pill mini / bubble alert melebarkan window sesuai konten", () => {
    expect(petWindowLogicalSize(1, { alert: false, mini: true, timer: false }).width).toBe(330);
    expect(petWindowLogicalSize(1, { alert: true, mini: false, timer: false }).width).toBe(360);
    expect(petWindowLogicalSize(1, { alert: true, mini: false, timer: false }).height)
      .toBe(160 + 190 + 8);
  });

  it("badge timer menambah tinggi seperlunya", () => {
    expect(petWindowLogicalSize(1, { alert: false, mini: false, timer: true }).height)
      .toBe(168 + 28);
  });
});

describe("measurePetContentHeight (bubble tidak kepotong)", () => {
  afterEach(() => vi.restoreAllMocks());

  function mockDom(o: {
    petH?: number; speechH?: number; miniH?: number; statusH?: number; hasBubble?: boolean;
  }) {
    vi.spyOn(document, "querySelector").mockImplementation((sel: string) => {
      if (sel === ".dp-pet-wrap") {
        return o.petH ? { getBoundingClientRect: () => ({ height: o.petH }) } as unknown as Element : null;
      }
      if (sel === ".dp-root.has-bubble") return (o.hasBubble ? {} : null) as unknown as Element;
      const map: Record<string, number | undefined> = {
        ".dp-root > .dp-speech": o.speechH,
        ".dp-root > .dp-bubble-mini": o.miniH,
        ".dp-root > .dp-status": o.statusH,
      };
      const h = map[sel];
      return (h ? { offsetHeight: h } : null) as unknown as Element;
    });
  }

  it("tanpa bubble: tidak lebih kecil dari ukuran tight", () => {
    mockDom({});
    expect(measurePetContentHeight(1)).toBe(168);
    expect(measurePetContentHeight(0.5)).toBe(104);
  });

  it("bubble pendek: tinggi = konten + margin layout", () => {
    // pet 128 + napas 8 + bubble 100 + margin 2 + padding bawah 10 + pengaman 2
    mockDom({ petH: 128, speechH: 100, hasBubble: true });
    expect(measurePetContentHeight(1)).toBe(8 + 100 + 2 + 128 + 10 + 2);
  });

  it("bubble panjang (judul pengingat panjang): window ikut meninggi", () => {
    const short = (() => { mockDom({ petH: 128, speechH: 100, hasBubble: true }); return measurePetContentHeight(1); })();
    vi.restoreAllMocks();
    mockDom({ petH: 128, speechH: 260, hasBubble: true });
    const tall = measurePetContentHeight(1);
    expect(tall).toBe(8 + 260 + 2 + 128 + 10 + 2);
    expect(tall).toBeGreaterThan(short);
  });

  it("pill mini + badge timer ikut dihitung", () => {
    mockDom({ petH: 64, miniH: 23, statusH: 26, hasBubble: true });
    expect(measurePetContentHeight(0.5)).toBe(8 + 23 + 4 + 64 + 6 + 26 + 10 + 2);
  });
});
