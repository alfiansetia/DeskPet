/** Regression: bubble suhu menumpuk DI ATAS pill sholat (urutan DOM),
 * keduanya sembunyi saat alert/panel. Toggle tempBubbleEnabled mengaturnya.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import App from "./App";
import { toYMD } from "./features/prayer/prayer";

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function seedPrayerAndWeather() {
  const now = new Date();
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
  localStorage.setItem("deskpet:weather:1301", JSON.stringify({
    tempC: 28, feelsLikeC: 31, humidity: 75, windKph: 12, code: 61,
    label: "Hujan", icon: "cloudRain", cityLabel: "JAKARTA",
    fetchedAt: new Date().toISOString(), stale: false,
  }));
}

describe("App temp bubble stacking", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

  it("suhu tampil di atas pill sholat (tumpuk vertikal)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    seedPrayerAndWeather();
    render(<App />);
    const temp = await screen.findByTestId("temp-bubble", undefined, { timeout: 3000 });
    const mini = await screen.findByTestId("prayer-mini", undefined, { timeout: 3000 });
    expect(temp.textContent).toContain("28°");
    // urutan DOM = urutan tumpuk (flex kolom): suhu dulu, lalu pill sholat
    const kids = Array.from(document.querySelector(".dp-root")!.children);
    expect(kids.indexOf(temp)).toBeLessThan(kids.indexOf(mini));
  });

  it("toggle mati menyembunyikan bubble suhu saja", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    seedPrayerAndWeather();
    localStorage.setItem("deskpet:settings", JSON.stringify({ tempBubbleEnabled: false }));
    render(<App />);
    await screen.findByTestId("prayer-mini", undefined, { timeout: 3000 });
    expect(document.querySelector("[data-testid='temp-bubble']")).toBeNull();
  });
});
