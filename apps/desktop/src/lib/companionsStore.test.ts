import { describe, expect, it, beforeEach } from "vitest";
import {
  addCompanion, exportBackup, importBackup, loadCompanions, removeCompanion, saveCompanions, store, updateCompanion,
  MAIN_COMPANION_ID, MAX_COMPANIONS,
} from "./store";

describe("companions store (multi-pet B)", () => {
  beforeEach(() => { localStorage.clear(); });

  it("migrates legacy single pet to main on first load", () => {
    const list = loadCompanions({ petSpecies: "frog", petPaletteId: "rose", petScale: 1.1 });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(MAIN_COMPANION_ID);
    expect(list[0].species).toBe("frog");
  });

  it("adds up to max and rejects beyond", () => {
    loadCompanions();
    for (let i = 0; i < MAX_COMPANIONS - 1; i++) {
      expect(addCompanion({ species: "cat", paletteId: "sky" })).not.toBeNull();
    }
    expect(loadCompanions()).toHaveLength(MAX_COMPANIONS);
    expect(addCompanion({ species: "snake" })).toBeNull();
  });

  it("updates role and removes secondary (never main)", () => {
    loadCompanions();
    const added = addCompanion({ species: "snake", paletteId: "matcha" });
    expect(added).not.toBeNull();
    const afterRole = updateCompanion(added!.id, { role: "prayer" });
    expect(afterRole.find((c) => c.id === added!.id)?.role).toBe("prayer");
    // main tidak bisa dihapus
    removeCompanion(MAIN_COMPANION_ID);
    expect(loadCompanions().some((c) => c.id === MAIN_COMPANION_ID)).toBe(true);
    const afterRemove = removeCompanion(added!.id);
    expect(afterRemove.some((c) => c.id === added!.id)).toBe(false);
  });

  it("backup round-trips companions", () => {
    loadCompanions();
    addCompanion({ species: "frog" });
    const json = exportBackup();
    localStorage.clear();
    expect(importBackup(json).ok).toBe(true);
    expect(loadCompanions().length).toBe(2);
  });

  it("persists via store key", () => {
    saveCompanions(loadCompanions());
    expect(store.companions.all().length).toBe(1);
  });

  it("resize updating companion scale (render memakai companion.scale)", () => {
    // Regresi: slider/menu_resize wajib update companion.scale, bukan cuma
    // settings.petScale — window merender me.scale (App.tsx).
    const list = loadCompanions();
    expect(list[0].scale).toBe(1);
    const after = updateCompanion(MAIN_COMPANION_ID, { scale: 1.5 });
    expect(after.find((c) => c.id === MAIN_COMPANION_ID)?.scale).toBe(1.5);
    // Simulasi render App: companion.scale menang atas settings fallback.
    const me = after.find((c) => c.id === MAIN_COMPANION_ID);
    const rendered = me?.scale ?? 1;
    expect(rendered).toBe(1.5);
    // Clamp 0.5–2 via normalize.
    const clamped = updateCompanion(MAIN_COMPANION_ID, { scale: 9 });
    expect(clamped.find((c) => c.id === MAIN_COMPANION_ID)?.scale).toBeLessThanOrEqual(2);
  });
});
