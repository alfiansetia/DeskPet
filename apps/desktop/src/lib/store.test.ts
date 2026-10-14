import { describe, expect, it, beforeEach } from "vitest";
import { DEFAULT_SETTINGS, exportBackup, importBackup, loadSettings, saveSettings, store } from "./store";

beforeEach(() => { localStorage.clear(); });

describe("settings persistence", () => {
  it("round-trips full settings incl. prayer fields (simulasi restart)", () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      petScale: 1.5,
      prayerCityId: "1638",
      prayerCityName: "KOTA SURABAYA",
      prayerAdzanEnabled: false,
      prayerReminderMins: 5,
      prayerMiniEnabled: false,
      prayerBubbleEnabled: false,
      timerBadgeEnabled: false,
      timerDoneAlertEnabled: false,
      wanderEnabled: false,
    });
    // Simulasi restart: baca ulang dari storage seperti useState(() => loadSettings()).
    const reloaded = loadSettings();
    expect(reloaded.petScale).toBe(1.5);
    expect(reloaded.prayerCityId).toBe("1638");
    expect(reloaded.prayerCityName).toBe("KOTA SURABAYA");
    expect(reloaded.prayerAdzanEnabled).toBe(false);
    expect(reloaded.prayerReminderMins).toBe(5);
    expect(reloaded.prayerMiniEnabled).toBe(false);
    expect(reloaded.prayerBubbleEnabled).toBe(false);
    expect(reloaded.timerBadgeEnabled).toBe(false);
    expect(reloaded.timerDoneAlertEnabled).toBe(false);
    expect(reloaded.wanderEnabled).toBe(false);
    expect(reloaded.telemetryEnabled).toBe(false);
  });
  it("old saved settings without new fields get safe defaults", () => {
    localStorage.setItem("deskpet:settings", JSON.stringify({ alwaysOnTop: false }));
    const reloaded = loadSettings();
    expect(reloaded.alwaysOnTop).toBe(false);
    expect(reloaded.prayerCityId).toBe(DEFAULT_SETTINGS.prayerCityId);
    expect(reloaded.prayerMiniEnabled).toBe(true);
    expect(reloaded.prayerBubbleEnabled).toBe(true);
    expect(reloaded.timerBadgeEnabled).toBe(true);
    expect(reloaded.timerDoneAlertEnabled).toBe(true);
  });
  it("migrasi paket karakter lama ke satu kucing + palette terdekat", () => {
    localStorage.setItem("deskpet:settings", JSON.stringify({ characterId: "deskpet.cat.orange" }));
    let r = loadSettings();
    expect(r.characterId).toBe("deskpet.cat");
    expect(r.petPaletteId).toBe("peach");

    localStorage.setItem("deskpet:settings", JSON.stringify({ characterId: "deskpet.cat.black" }));
    r = loadSettings();
    expect(r.characterId).toBe("deskpet.cat");
    expect(r.petPaletteId).toBe("midnight");

    // pilihan palette sendiri tidak ditimpa migrasi
    localStorage.setItem("deskpet:settings", JSON.stringify({ characterId: "deskpet.cat.orange", petPaletteId: "sky" }));
    r = loadSettings();
    expect(r.characterId).toBe("deskpet.cat");
    expect(r.petPaletteId).toBe("sky");
  });
  it("spesies default kucing; nilai asing dinormalisasi", () => {
    localStorage.setItem("deskpet:settings", JSON.stringify({}));
    let r = loadSettings();
    expect(r.petSpecies).toBe("cat");
    expect(r.characterId).toBe("deskpet.cat");

    localStorage.setItem("deskpet:settings", JSON.stringify({ petSpecies: "snake" }));
    r = loadSettings();
    expect(r.petSpecies).toBe("snake");
    expect(r.characterId).toBe("deskpet.snake");

    localStorage.setItem("deskpet:settings", JSON.stringify({ petSpecies: "naga" }));
    r = loadSettings();
    expect(r.petSpecies).toBe("cat");
    expect(r.characterId).toBe("deskpet.cat");
  });
});

describe("store backup/restore", () => {
  it("exports valid DeskPet JSON", () => {
    const json = exportBackup();
    const d = JSON.parse(json);
    expect(d.app).toBe("deskpet");
    expect(Array.isArray(d.todos)).toBe(true);
  });
  it("round-trips todos", () => {
    store.todos.save([{ id: "t1", title: "x", status: "open", priority: 0, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }]);
    const json = exportBackup();
    localStorage.clear();
    const r = importBackup(json);
    expect(r.ok).toBe(true);
    expect(store.todos.all().length).toBe(1);
  });
  it("rejects foreign files", () => {
    expect(importBackup('{"app":"other"}').ok).toBe(false);
    expect(importBackup("not json").ok).toBe(false);
  });
});
