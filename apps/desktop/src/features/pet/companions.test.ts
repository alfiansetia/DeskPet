import { describe, expect, it } from "vitest";
import {
  companionIdFromWindowLabel,
  migrateFromLegacy,
  normalizeCompanion,
  normalizeCompanionList,
  phaseDelayMsFor,
  resolvePresenterFor,
  slotPeriodJitterMsFor,
  slotPhaseFor,
  windowLabelFor,
  type Companion,
} from "./companions";

describe("companions model (multi-pet B)", () => {
  it("window label mapping round-trips", () => {
    expect(windowLabelFor("main")).toBe("pet");
    expect(windowLabelFor("c_abc123")).toBe("pet-c_abc123");
    expect(companionIdFromWindowLabel("pet")).toBe("main");
    expect(companionIdFromWindowLabel("pet-c_abc123")).toBe("c_abc123");
    expect(companionIdFromWindowLabel("bogus")).toBe("main");
  });

  it("migrates legacy single pet to main companion", () => {
    const list = migrateFromLegacy({ petSpecies: "snake", petPaletteId: "sky", petScale: 1.2 });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("main");
    expect(list[0].species).toBe("snake");
    expect(list[0].paletteId).toBe("sky");
    expect(list[0].scale).toBe(1.2);
  });

  it("normalizes corrupt entries safely", () => {
    const c = normalizeCompanion({ id: "!!!", species: "dragon", scale: 99 });
    expect(c.species).toBe("cat");
    expect(c.scale).toBeLessThanOrEqual(2);
  });

  it("dedupes ids and caps at max", () => {
    const raw = Array.from({ length: 8 }, (_, i) => ({ id: "main", species: "cat", name: `P${i}` }));
    const list = normalizeCompanionList(raw);
    expect(list.length).toBeLessThanOrEqual(5);
    expect(new Set(list.map((c) => c.id)).size).toBe(list.length);
  });

  it("routes alerts by role with fallback", () => {
    const list: Companion[] = [
      normalizeCompanion({ id: "main", species: "cat", role: "reminder", name: "A" }),
      normalizeCompanion({ id: "c_x1", species: "snake", role: "prayer", name: "B" }),
      normalizeCompanion({ id: "c_x2", species: "frog", role: "decor", name: "C" }),
    ];
    expect(resolvePresenterFor(list, "prayer")?.id).toBe("c_x1");
    expect(resolvePresenterFor(list, "timer")?.id).toBe("main"); // role=all? no -> fallback first eligible
    expect(resolvePresenterFor(list.filter((c) => c.role === "decor"), "reminder")?.role).toBe("decor");
    expect(resolvePresenterFor([], "reminder")).toBeNull();
  });

  it("pill display defaults to on", () => {
    const c = normalizeCompanion({ id: "c_x1", species: "cat" });
    expect(c.showTemp).toBe(true);
    expect(c.showMini).toBe(true);
    const off = normalizeCompanion({ id: "c_x2", species: "cat", showTemp: false, showMini: false });
    expect(off.showTemp).toBe(false);
    expect(off.showMini).toBe(false);
  });

  it("slot rotation desyncs per companion", () => {
    expect(slotPhaseFor("main")).toBe(0);
    expect(slotPeriodJitterMsFor("main")).toBe(0);
    // deterministik per id
    expect(slotPhaseFor("c_abc")).toBe(slotPhaseFor("c_abc"));
    expect(slotPeriodJitterMsFor("c_abc")).toBe(slotPeriodJitterMsFor("c_abc"));
    const j = slotPeriodJitterMsFor("c_abc");
    expect(j).toBeGreaterThanOrEqual(0);
    expect(j).toBeLessThan(1500);
    // fase valid 0/1
    for (const id of ["c_a1", "c_b2", "c_c3"]) {
      expect([0, 1]).toContain(slotPhaseFor(id));
    }
  });

  it("desynchronizes wander start", () => {
    expect(phaseDelayMsFor("main")).toBe(0);
    const d = phaseDelayMsFor("c_abc");
    expect(d).toBeGreaterThanOrEqual(400);
    expect(d).toBeLessThanOrEqual(2800);
  });
});
