/** Regression: bubble suhu menumpuk DI ATAS pill sholat (urutan DOM),
 * keduanya sembunyi saat alert/panel. Toggle tempBubbleEnabled mengaturnya.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

/** Seed +25 mnt tidak valid bila nyebrang tengah malam (hhmm tanpa tanggal jadi
 *  terbaca sudah lewat). Lewati skenario future-prayer di ~30 mnt sebelum
 *  tengah malam. */
function futurePrayerPossible(): boolean {
  return toYMD(new Date(Date.now() + 30 * 60_000)) === toYMD(new Date());
}

describe("App temp bubble stacking", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

  it.runIf(futurePrayerPossible())("suhu dan countdown sholat bergantian tiap 4 detik (satu slot)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    seedPrayerAndWeather();
    render(<App />);
    // Tunggu salah satu muncul — dan pastikan tidak pernah berbarengan.
    let first = "";
    await waitFor(() => {
      const t = document.querySelector("[data-testid='temp-bubble']");
      const m = document.querySelector("[data-testid='prayer-mini']");
      expect(t ?? m).not.toBeNull();
      expect(t && m ? "bareng" : null).toBeNull();
      first = t ? "temp-bubble" : "prayer-mini";
    }, { timeout: 3000 });
    const other = first === "temp-bubble" ? "prayer-mini" : "temp-bubble";
    // Rotasi: yang lain muncul dan yang pertama ngalah (maks 8 dtk).
    await waitFor(() => {
      expect(document.querySelector(`[data-testid='${other}']`)).not.toBeNull();
      expect(document.querySelector(`[data-testid='${first}']`)).toBeNull();
    }, { timeout: 8000 });
  }, 15000);

  it.runIf(futurePrayerPossible())("toggle mati menyembunyikan bubble suhu saja", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    seedPrayerAndWeather();
    localStorage.setItem("deskpet:settings", JSON.stringify({ tempBubbleEnabled: false }));
    render(<App />);
    await screen.findByTestId("prayer-mini", undefined, { timeout: 3000 });
    expect(document.querySelector("[data-testid='temp-bubble']")).toBeNull();
  });

  it("offset sapaan mengikuti slot pill (--above 26px bila slot terisi)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    seedPrayerAndWeather();
    render(<App />);
    await waitFor(() => {
      expect(
        document.querySelector("[data-testid='temp-bubble']") ?? document.querySelector("[data-testid='prayer-mini']"),
      ).not.toBeNull();
    }, { timeout: 3000 });
    const stack = screen.getByTestId("pet-stack");
    expect(stack.style.getPropertyValue("--above")).toBe("26px");
  });

  it("tanpa pill, offset sapaan nol", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<App />);
    await screen.findByTestId("drag-region");
    const stack = screen.getByTestId("pet-stack");
    expect(stack.style.getPropertyValue("--above")).toBe("0px");
  });

  it("sapaan menyela slot sementara (gantian: tidak menumpuk, tidak kepotong)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    seedPrayerAndWeather();
    render(<App />);
    await waitFor(() => {
      expect(
        document.querySelector("[data-testid='temp-bubble']") ?? document.querySelector("[data-testid='prayer-mini']"),
      ).not.toBeNull();
    }, { timeout: 3000 });
    // Klik pet (tanpa geser = bukan drag) -> sapaan muncul
    const drag = screen.getByTestId("drag-region");
    fireEvent.mouseDown(drag, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseUp(drag, { button: 0, clientX: 100, clientY: 100 });
    await screen.findByTestId("pet-greet", undefined, { timeout: 3000 });
    // Selama sapaan tampil, slot ngalah (satu slot, tidak tumpuk)
    expect(document.querySelector("[data-testid='temp-bubble']")).toBeNull();
    expect(document.querySelector("[data-testid='prayer-mini']")).toBeNull();
    expect(screen.getByTestId("pet-stack").style.getPropertyValue("--above")).toBe("0px");
    // ...tapi layout tetap dijangkar bawah (tidak center -> tidak kepotong atas)
    expect(document.querySelector(".dp-root.has-bubble")).not.toBeNull();
    // Sapaan hilang ~2,6 dtk -> slot kembali (salah satu isi)
    await waitFor(
      () => expect(
        document.querySelector("[data-testid='temp-bubble']") ?? document.querySelector("[data-testid='prayer-mini']"),
      ).not.toBeNull(),
      { timeout: 6000 },
    );
  });
});
