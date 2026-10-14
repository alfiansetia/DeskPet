/** Regression: jadwal sholat cache-first (tanpa network & tanpa audit bila
 * cache ada); audit prayer.fetch hanya untuk akses network sungguhan.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { PrayerView } from "./PrayerView";
import { loadSettings, store } from "../../lib/store";
import { toYMD } from "./prayer";

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function seedCache() {
  const now = new Date();
  const ymd = toYMD(now);
  const past = (h: number) => { const d = new Date(now); d.setHours(h, 0, 0, 0); return d; };
  localStorage.setItem(`deskpet:prayer:1301:${ymd}`, JSON.stringify({
    date: ymd, cityId: "1301", cityName: "KOTA JAKARTA",
    imsak: hhmm(past(4)), subuh: hhmm(past(4)), terbit: hhmm(past(5)),
    dhuha: hhmm(past(6)), dzuhur: hhmm(past(11)), ashar: hhmm(past(15)),
    maghrib: hhmm(past(18)), isya: hhmm(past(19)), source: "myquran",
  }));
}

function renderView() {
  return render(
    <PrayerView settings={loadSettings()} setSettings={() => {}} bump={() => {}} />
  );
}

describe("PrayerView cache-first", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

  it("cache ada -> tanpa fetch jadwal & tanpa audit", async () => {
    seedCache();
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    renderView();
    await screen.findByTestId("prayer-list");
    // tidak ada panggilan network ke endpoint jadwal (fetchCities boleh jalan)
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("jadwal"), expect.anything(),
    );
    expect(store.audit.all()).toHaveLength(0);
  });

  it("tanpa cache + online -> fetch sekali + audit sekali", async () => {
    const ymd = toYMD(new Date());
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes("jadwal")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: true,
            data: {
              lokasi: "KOTA JAKARTA",
              jadwal: {
                date: ymd, imsak: "04:30", subuh: "04:40", terbit: "05:55",
                dhuha: "06:25", dzuhur: "11:55", ashar: "15:10",
                maghrib: "17:55", isya: "19:10",
              },
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderView();
    await screen.findByTestId("prayer-list");
    const jadwalCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("jadwal"));
    expect(jadwalCalls).toHaveLength(1);
    const prays = store.audit.all().filter((a) => a.actionId === "prayer.fetch");
    expect(prays).toHaveLength(1);
  });
});
