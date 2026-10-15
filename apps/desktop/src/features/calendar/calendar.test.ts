import { describe, expect, it } from "vitest";
import { buildMonthGrid, groupByDay, monthLabel, WEEKDAYS_ID, ymdLocal, ymdOfIso } from "./calendar";

describe("calendar helpers", () => {
  it("ymd lokal tidak geser hari (bukan UTC)", () => {
    // 20 Okt 2026 00:30 +07:00 = 19 Okt UTC — harus tetap 20 Okt lokal.
    const d = new Date(2026, 9, 20, 0, 30);
    expect(ymdLocal(d)).toBe("2026-10-20");
    expect(ymdOfIso(new Date(2026, 9, 20, 0, 30).toISOString())).toBe("2026-10-20");
    expect(ymdOfIso("ngaco")).toBeNull();
  });

  it("label bulan Indonesia", () => {
    expect(monthLabel(2026, 9)).toBe("Oktober 2026");
    expect(WEEKDAYS_ID).toEqual(["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]);
  });

  it("grid 42 sel, Senin dulu, stabil tiap bulan", () => {
    // 1 Okt 2026 = Kamis → lead 3 (Sen 28 Sep …).
    const grid = buildMonthGrid(2026, 9);
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1); // Senin
    expect(ymdLocal(grid[0])).toBe("2026-09-28");
    expect(ymdLocal(grid[3])).toBe("2026-10-01");
    // Februari kabisat 2024 tetap 42 sel.
    const feb = buildMonthGrid(2024, 1);
    expect(feb).toHaveLength(42);
    expect(feb.filter((d) => d.getMonth() === 1)).toHaveLength(29);
  });

  it("groupByDay mengelompokkan pengingat per tanggal lokal", () => {
    const items = [
      { id: "a", due: new Date(2026, 9, 20, 9, 0).toISOString() },
      { id: "b", due: new Date(2026, 9, 20, 16, 0).toISOString() },
      { id: "c", due: new Date(2026, 9, 21, 9, 0).toISOString() },
      { id: "x", due: "invalid" },
    ];
    const map = groupByDay(items, (i) => i.due);
    expect(map.get("2026-10-20")?.map((i) => i.id)).toEqual(["a", "b"]);
    expect(map.get("2026-10-21")?.map((i) => i.id)).toEqual(["c"]);
    expect(map.has("invalid")).toBe(false);
  });
});
