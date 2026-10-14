import { describe, expect, it } from "vitest";
import { HAT_ANCHORS, HATS, hatById, newlyUnlocked, unlockedHats, validActiveHat } from "./hats";

describe("hats", () => {
  it("jangkar ada untuk semua spesies", () => {
    for (const sp of ["cat", "snake", "frog", "owl", "penguin"] as const) {
      const a = HAT_ANCHORS[sp];
      expect(a.size).toBeGreaterThan(0);
    }
  });

  it("unlock bertahap sesuai elusan", () => {
    expect(unlockedHats(0).map((h) => h.id)).toEqual(["none", "cap"]);
    expect(unlockedHats(5).map((h) => h.id)).toEqual(["none", "cap", "party"]);
    expect(unlockedHats(15).map((h) => h.id)).toContain("crown");
  });

  it("baru terbuka dihitung dari selisih", () => {
    expect(newlyUnlocked(4, 5).map((h) => h.id)).toEqual(["party"]);
    expect(newlyUnlocked(5, 5)).toEqual([]);
    expect(newlyUnlocked(0, 20).map((h) => h.id)).toEqual(["party", "crown"]);
  });

  it("topi aktif valid hanya bila terbuka", () => {
    expect(validActiveHat("crown", 15)).toBe("crown");
    expect(validActiveHat("crown", 5)).toBeNull();
    expect(validActiveHat("none", 99)).toBeNull();
    expect(validActiveHat("ngaco", 99)).toBeNull();
    expect(hatById("ngaco").id).toBe("none");
    expect(HATS.length).toBeGreaterThanOrEqual(4);
  });
});
