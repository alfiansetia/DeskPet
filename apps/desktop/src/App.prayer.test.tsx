/** Regression: pill countdown sholat + render App end-to-end (jsdom).
 * Memastikan miniNext tampil saat cache jadwal hari ini valid.
 */
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import App from "./App";
import { store } from "./lib/store";
import { toYMD } from "./features/prayer/prayer";

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Seed +25/+85 mnt tidak valid bila nyebrang tengah malam (format hhmm tanpa
 *  tanggal jadi terbaca sudah lewat). Lewati skenario future-prayer di ~30 mnt
 *  sebelum tengah malam; di luar itu selalu valid. */
function futurePrayerPossible(): boolean {
  return toYMD(new Date(Date.now() + 30 * 60_000)) === toYMD(new Date());
}

describe("App prayer pill", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

  it.runIf(futurePrayerPossible())("pill countdown tampil saat belum masuk window pengingat H-X", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const now = new Date();
    // Maghrib 25 mnt lagi: di luar window H-10 mnt (tidak memicu alert),
    // jadi pill mini yang tampil (alert menyembunyikan pill by design).
    const in25 = new Date(now.getTime() + 25 * 60_000);
    const in85 = new Date(now.getTime() + 85 * 60_000);
    const past = (h: number) => { const d = new Date(now); d.setHours(h, 0, 0, 0); return d; };
    const ymd = toYMD(now);
    localStorage.setItem(`deskpet:prayer:1301:${ymd}`, JSON.stringify({
      date: ymd, cityId: "1301", cityName: "KOTA JAKARTA",
      imsak: hhmm(past(4)), subuh: hhmm(past(4)), terbit: hhmm(past(5)),
      dhuha: hhmm(past(6)), dzuhur: hhmm(past(11)), ashar: hhmm(past(15)),
      maghrib: hhmm(in25), isya: hhmm(in85), source: "cache",
    }));

    render(<App />);
    const pill = await screen.findByTestId("prayer-mini", undefined, { timeout: 3000 });
    expect(pill.textContent).toContain("Maghrib");
    await waitFor(() => {
      expect(document.querySelector(".dp-root.has-bubble")).not.toBeNull();
    });
  });

  it.runIf(futurePrayerPossible())("boot tanpa cache + online -> network sekali + audit prayer.fetch sekali", async () => {
    const ymd = toYMD(new Date());
    const now = new Date();
    const in25 = new Date(now.getTime() + 25 * 60_000);
    const in85 = new Date(now.getTime() + 85 * 60_000);
    const past = (h: number) => { const d = new Date(now); d.setHours(h, 0, 0, 0); return d; };
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes("open-meteo") || String(url).includes("geocoding")) {
        return Promise.reject(new Error("cuaca offline di test"));
      }
      if (String(url).includes("jadwal")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: true,
            data: {
              lokasi: "KOTA JAKARTA",
              jadwal: {
                date: ymd, imsak: hhmm(past(4)), subuh: hhmm(past(4)), terbit: hhmm(past(5)),
                dhuha: hhmm(past(6)), dzuhur: hhmm(past(11)), ashar: hhmm(past(15)),
                maghrib: hhmm(in25), isya: hhmm(in85),
              },
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByTestId("prayer-mini", undefined, { timeout: 5000 });
    const jadwalCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("jadwal"));
    expect(jadwalCalls).toHaveLength(1);
    expect(store.audit.all().filter((a) => a.actionId === "prayer.fetch")).toHaveLength(1);
  });
});
