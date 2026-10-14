import { describe, expect, it } from "vitest";
import { decayStats, feedStats, fullStats, needsCare, normalizeStats, playStats } from "./care";

const T0 = Date.parse("2026-01-01T00:00:00Z");
const H = 3_600_000;

describe("care stats", () => {
  it("meluruh proporsional waktu + clamp 0", () => {
    const s = decayStats({ ...fullStats(T0), updatedAt: new Date(T0).toISOString() }, T0 + 2 * H);
    expect(s.hunger).toBe(84);
    expect(s.mood).toBe(90);
    expect(s.energy).toBe(88);
    const empty = decayStats({ hunger: 5, mood: 3, energy: 2, updatedAt: new Date(T0).toISOString() }, T0 + 48 * H);
    expect([empty.hunger, empty.mood, empty.energy]).toEqual([0, 0, 0]);
  });

  it("tidur memulihkan energi", () => {
    const s = decayStats({ hunger: 80, mood: 80, energy: 40, updatedAt: new Date(T0).toISOString() }, T0 + 2 * H, true);
    expect(s.energy).toBe(64);
    expect(s.hunger).toBe(64); // lapar tetap jalan saat tidur
  });

  it("makan & main", () => {
    const fed = feedStats({ hunger: 10, mood: 50, energy: 50, updatedAt: new Date(T0).toISOString() });
    expect(fed.hunger).toBe(100);
    expect(fed.mood).toBe(60);
    const played = playStats({ hunger: 50, mood: 10, energy: 50, updatedAt: new Date(T0).toISOString() });
    expect(played.mood).toBe(100);
    expect(played.hunger).toBe(42);
    expect(played.energy).toBe(42);
  });

  it("ambang kebutuhan", () => {
    expect(needsCare(fullStats(T0))).toEqual([]);
    expect(needsCare({ hunger: 10, mood: 90, energy: 90, updatedAt: "" })).toEqual(["hungry"]);
    expect(needsCare({ hunger: 10, mood: 10, energy: 10, updatedAt: "" })).toEqual(["hungry", "lonely", "tired"]);
  });

  it("normalisasi simpanan korup", () => {
    expect(normalizeStats(undefined, T0)).toEqual(fullStats(T0));
    const s = normalizeStats({ hunger: 999, mood: -5, energy: NaN, updatedAt: "ngaco" }, T0);
    expect(s).toEqual({ hunger: 100, mood: 0, energy: 100, updatedAt: new Date(T0).toISOString() });
  });
});
