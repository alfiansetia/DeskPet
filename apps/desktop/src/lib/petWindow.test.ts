import { describe, expect, it, vi, afterEach } from "vitest";
import { petWindowLogicalSize, measurePetContentHeight, measurePetContentWidth, resolveEffectiveScale, petWrapBox, PET_BASE_SCALE } from "./petWindow";

describe("resolveEffectiveScale (aset 50% @100%)", () => {
  it("skala dasar 0.5: 100% = setengah aset", () => {
    expect(PET_BASE_SCALE).toBe(0.5);
    expect(resolveEffectiveScale(1, false)).toBe(0.5);
  });

  it("slider 50–200% tetap relatif terhadap default baru", () => {
    expect(resolveEffectiveScale(0.5, false)).toBe(0.25);
    expect(resolveEffectiveScale(2, false)).toBe(1);
  });

  it("alert penting selalu 2x ukuran normal user", () => {
    expect(resolveEffectiveScale(1, true)).toBe(1);
    expect(resolveEffectiveScale(2, true)).toBe(1);
    expect(resolveEffectiveScale(1, true)).toBe(resolveEffectiveScale(1, false) * 2);
  });

  it("window default baru ~96px (dulu 160px)", () => {
    expect(petWindowLogicalSize(resolveEffectiveScale(1, false), { alert: false, mini: false, temp: false, timer: false }))
      .toEqual({ width: 96, height: 102 });
  });

  it("nilai korup diamankan ke default", () => {
    expect(resolveEffectiveScale(NaN, false)).toBe(0.5);
    expect(resolveEffectiveScale(99, false)).toBe(1);
  });
});

describe("petWrapBox (layout = visual, tanpa gap hantu)", () => {
  it("box layout sama dengan ukuran visual hasil scale", () => {
    expect(petWrapBox(0.5)).toEqual({ width: 64, height: 64 });
    expect(petWrapBox(1)).toEqual({ width: 128, height: 128 });
    expect(petWrapBox(0.25)).toEqual({ width: 32, height: 32 });
  });
});

describe("petWindowLogicalSize (blocking area dinamis)", () => {
  it("tanpa konten tambahan: window dipeluk ke sprite + breathing", () => {
    // scale 1: 128 + 32 = 160 lebar, +6 = 166 tinggi (dulu 220x236)
    expect(petWindowLogicalSize(1, { alert: false, mini: false, temp: false, timer: false }))
      .toEqual({ width: 160, height: 166 });
  });

  it("mengecil saat pet diperkecil (blocking ikut kecil)", () => {
    const small = petWindowLogicalSize(0.5, { alert: false, mini: false, temp: false, timer: false });
    const normal = petWindowLogicalSize(1, { alert: false, mini: false, temp: false, timer: false });
    expect(small).toEqual({ width: 96, height: 102 });
    expect(small.width).toBeLessThan(normal.width);
    expect(small.height).toBeLessThan(normal.height);
  });

  it("membesar saat alert 200% tapi tetap proporsional sprite", () => {
    expect(petWindowLogicalSize(2, { alert: false, mini: false, temp: false, timer: false }))
      .toEqual({ width: 288, height: 294 });
  });

  it("pill mini / bubble alert melebarkan window sesuai konten", () => {
    expect(petWindowLogicalSize(1, { alert: false, mini: true, temp: false, timer: false }).width).toBe(330);
    expect(petWindowLogicalSize(1, { alert: true, mini: false, temp: false, timer: false }).width).toBe(360);
    expect(petWindowLogicalSize(1, { alert: true, mini: false, temp: false, timer: false }).height)
      .toBe(160 + 190 + 6);
  });

  it("badge timer menambah tinggi seperlunya", () => {
    expect(petWindowLogicalSize(1, { alert: false, mini: false, temp: false, timer: true }).height)
      .toBe(166 + 28);
  });

  it("satu slot rotasi: mini+temp tersedia tetap satu cadangan pill", () => {
    const base = petWindowLogicalSize(1, { alert: false, mini: true, temp: false, timer: false });
    const stacked = petWindowLogicalSize(1, { alert: false, mini: true, temp: true, timer: false });
    expect(stacked.height).toBe(base.height);
    expect(stacked.width).toBe(base.width);
  });

  it("bubble suhu saja (tanpa mini) melebarkan window agar tidak kepotong samping", () => {
    const tight = petWindowLogicalSize(1, { alert: false, mini: false, temp: false, timer: false });
    const tempOnly = petWindowLogicalSize(1, { alert: false, mini: false, temp: true, timer: false });
    expect(tempOnly.width).toBe(250);
    expect(tempOnly.width).toBeGreaterThan(tight.width);
    expect(tempOnly.height).toBe(tight.height + 38);
  });
});

describe("measurePetContentHeight (bubble tidak kepotong)", () => {
  afterEach(() => vi.restoreAllMocks());

  function mockDom(o: {
    petH?: number; stackH?: number; speechH?: number; miniH?: number; tempH?: number; greetH?: number; heartsH?: number; emoteH?: number; statusH?: number; hasBubble?: boolean; hasStatus?: boolean;
  }) {
    vi.spyOn(document, "querySelector").mockImplementation((sel: string) => {
      if (sel === ".dp-pet-wrap") {
        return o.petH ? { getBoundingClientRect: () => ({ height: o.petH }) } as unknown as Element : null;
      }
      if (sel === ".dp-root.has-bubble") return (o.hasBubble ? {} : null) as unknown as Element;
      if (sel === ".dp-root.has-status") return (o.hasStatus ? {} : null) as unknown as Element;
      const map: Record<string, number | undefined> = {
        ".dp-pet-stack": o.stackH,
        "[data-testid='pet-stack']": o.stackH,
        ".dp-root > .dp-speech": o.speechH,
        ".dp-root > .dp-bubble-mini": o.miniH,
        ".dp-root > .dp-bubble-temp": o.tempH,
        ".dp-pet-stack > .dp-greet": o.greetH,
        "[data-testid='pet-stack'] > .dp-greet": o.greetH,
        ".dp-pet-stack > .dp-hearts": o.heartsH,
        "[data-testid='pet-stack'] > .dp-hearts": o.heartsH,
        ".dp-pet-stack > .dp-micro-emote": o.emoteH,
        "[data-testid='pet-stack'] > .dp-micro-emote": o.emoteH,
        ".dp-root > .dp-status": o.statusH,
      };
      const h = map[sel];
      return (h ? { offsetHeight: h, scrollWidth: h } : null) as unknown as Element;
    });
  }

  it("tanpa bubble: tidak lebih kecil dari ukuran tight", () => {
    mockDom({});
    expect(measurePetContentHeight(1)).toBe(166);
    expect(measurePetContentHeight(0.5)).toBe(102);
  });

  it("bubble pendek: tinggi = konten + margin layout", () => {
    // pet 128 + napas 6 + bubble 100 + margin 0 + padding bawah 10 + pengaman 8
    mockDom({ petH: 128, speechH: 100, hasBubble: true });
    expect(measurePetContentHeight(1)).toBe(6 + 100 + 128 + 10 + 8);
  });

  it("bubble panjang (judul pengingat panjang): window ikut meninggi", () => {
    const short = (() => { mockDom({ petH: 128, speechH: 100, hasBubble: true }); return measurePetContentHeight(1); })();
    vi.restoreAllMocks();
    mockDom({ petH: 128, speechH: 260, hasBubble: true });
    const tall = measurePetContentHeight(1);
    expect(tall).toBe(6 + 260 + 128 + 10 + 8);
    expect(tall).toBeGreaterThan(short);
  });

  it("pill mini + badge timer ikut dihitung", () => {
    mockDom({ petH: 64, miniH: 23, statusH: 26, hasBubble: true });
    expect(measurePetContentHeight(0.5)).toBe(6 + 23 + 2 + 64 + 6 + 26 + 10 + 8);
  });

  it("bubble suhu menumpuk di atas pill (ikut dihitung + margin)", () => {
    mockDom({ petH: 64, tempH: 20, miniH: 23, hasBubble: true });
    expect(measurePetContentHeight(0.5)).toBe(6 + 20 + 2 + 23 + 2 + 64 + 10 + 8);
  });

  it("tinggi pet dari box stack, bukan rect wrap ber-transform", () => {
    // Browser: box stack 64, tapi rect wrap = 64 × scale 0.5 = 32.
    // Kode lama pakai 32 -> window ~32px kependekan -> atas kepotong.
    mockDom({ stackH: 64, petH: 32, tempH: 20, miniH: 23, hasBubble: true });
    expect(measurePetContentHeight(0.5)).toBe(6 + 20 + 2 + 23 + 2 + 64 + 10 + 8);
  });

  it("slot atas + badge timer bawah muat semua (kasus badge + slot)", () => {
    mockDom({ stackH: 64, petH: 32, miniH: 23, statusH: 22, hasBubble: true, hasStatus: true });
    expect(measurePetContentHeight(0.5)).toBe(6 + 23 + 2 + 64 + 6 + 22 + 10 + 8);
  });
  it("sapaan di atas tumpukan ikut dihitung (tidak kepotong window)", () => {
    mockDom({ petH: 64, tempH: 20, miniH: 23, greetH: 22, hasBubble: true });
    // napas + temp + mini + sapaan(22+6) + pet + padding + pengaman
    expect(measurePetContentHeight(0.5)).toBe(6 + 20 + 2 + 23 + 2 + 22 + 6 + 64 + 10 + 8);
  });

  it("hati saat dielus mencadangkan travel animasi (+8, tidak kepotong)", () => {
    mockDom({ petH: 64, heartsH: 18, hasBubble: true });
    // napas + hati(18+8) + pet + padding + pengaman
    expect(measurePetContentHeight(0.5)).toBe(6 + 18 + 8 + 64 + 10 + 8);
  });

  it("emote idle mencadangkan travel animasi (+26, tidak kepotong)", () => {
    mockDom({ petH: 64, emoteH: 20, hasBubble: true });
    // napas + emote(20+26) + pet + padding + pengaman
    expect(measurePetContentHeight(0.5)).toBe(6 + 20 + 26 + 64 + 10 + 8);
  });

  it("badge timer saja: konten dijangkar bawah (padding 10)", () => {
    mockDom({ petH: 128, statusH: 26, hasStatus: true });
    expect(measurePetContentHeight(1)).toBe(6 + 128 + 6 + 26 + 10 + 8);
  });
});

describe("measurePetContentWidth (pill tidak kepotong samping)", () => {
  afterEach(() => vi.restoreAllMocks());

  function mockWidth(o: { speechW?: number; miniW?: number; tempW?: number; greetW?: number }) {
    vi.spyOn(document, "querySelector").mockImplementation((sel: string) => {
      const map: Record<string, number | undefined> = {
        ".dp-root > .dp-speech": o.speechW,
        ".dp-root > .dp-bubble-mini": o.miniW,
        ".dp-root > .dp-bubble-temp": o.tempW,
        ".dp-pet-stack, [data-testid='pet-stack']": undefined,
        ".dp-pet-stack > .dp-greet": o.greetW,
        "[data-testid='pet-stack'] > .dp-greet": o.greetW,
        ".dp-root > .dp-status": undefined,
      };
      const w = map[sel];
      return (w ? { offsetWidth: w, scrollWidth: w } : null) as unknown as Element;
    });
  }

  it("tanpa konten: fallback dipakai apa adanya", () => {
    mockWidth({});
    expect(measurePetContentWidth(96)).toBe(96);
  });

  it("pill lebih lebar dari tebakan: window tumbuh secukupnya", () => {
    mockWidth({ miniW: 300 });
    // 300 + napas horizontal 24
    expect(measurePetContentWidth(250)).toBe(324);
  });

  it("konten sempit tidak menyusutkan window (anti-flicker)", () => {
    mockWidth({ tempW: 120 });
    expect(measurePetContentWidth(250)).toBe(250);
  });
});
