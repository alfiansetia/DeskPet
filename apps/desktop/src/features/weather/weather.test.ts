import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  CITY_COORDS, cleanCityName, describeCode, getCachedWeather, getWeather, resolveCoords,
} from "./weather";

beforeEach(() => { localStorage.clear(); });

describe("describeCode (WMO -> Indonesia)", () => {
  it("memetakan kode umum", () => {
    expect(describeCode(0)).toEqual({ label: "Cerah", icon: "sun" });
    expect(describeCode(1).icon).toBe("cloud");
    expect(describeCode(3)).toEqual({ label: "Mendung", icon: "cloud" });
    expect(describeCode(61)).toEqual({ label: "Hujan", icon: "cloudRain" });
    expect(describeCode(95)).toEqual({ label: "Badai petir", icon: "zap" });
    expect(describeCode(999).icon).toBe("cloud"); // tak dikenal -> aman
  });

  it("membersihkan nama kota Kemenag", () => {
    expect(cleanCityName("KOTA SURABAYA")).toBe("SURABAYA");
    expect(cleanCityName("KAB. BOGOR")).toBe("BOGOR");
    expect(cleanCityName("")).toBe("Jakarta");
  });
});

describe("resolveCoords", () => {
  it("kota populer tanpa network (tabel lokal)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      expect(await resolveCoords("1301", "KOTA JAKARTA")).toEqual({ lat: -6.2, lon: 106.85 });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(Object.keys(CITY_COORDS).length).toBeGreaterThanOrEqual(14);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("kota tak dikenal via geocoding + hasil di-cache", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ latitude: -7.0, longitude: 110.0 }] }),
    }));
    try {
      const c = await resolveCoords("9999", "KOTA entah");
      expect(c).toEqual({ lat: -7.0, lon: 110.0 });
      // panggilan kedua: dari cache, tanpa network
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("harus offline")));
      expect(await resolveCoords("9999", "KOTA entah")).toEqual({ lat: -7.0, lon: 110.0 });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("getWeather (cache-first)", () => {
  const apiPayload = {
    current: {
      temperature_2m: 28.4, apparent_temperature: 31.1,
      relative_humidity_2m: 75, wind_speed_10m: 12.3, weather_code: 61,
    },
  };

  it("cache segar dipakai tanpa network", async () => {
    const fresh = {
      tempC: 27, feelsLikeC: 30, humidity: 70, windKph: 10, code: 1,
      label: "Cerah berawan", icon: "cloud" as const, cityLabel: "JAKARTA",
      fetchedAt: new Date().toISOString(), stale: false,
    };
    localStorage.setItem("deskpet:weather:1301", JSON.stringify(fresh));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      expect(await getWeather("1301", "KOTA JAKARTA")).toEqual(fresh);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(getCachedWeather("1301")).toEqual(fresh);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("tanpa cache + online -> fetch + simpan", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => apiPayload }));
    try {
      const w = await getWeather("1301", "KOTA JAKARTA");
      expect(w).toMatchObject({ tempC: 28, feelsLikeC: 31, humidity: 75, windKph: 12.3, label: "Hujan", stale: false });
      expect(getCachedWeather("1301")?.tempC).toBe(28);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("offline + cache basi -> tandai stale (tetap tampil)", async () => {
    const old = {
      tempC: 27, feelsLikeC: 30, humidity: 70, windKph: 10, code: 1,
      label: "Cerah berawan", icon: "cloud" as const, cityLabel: "JAKARTA",
      fetchedAt: new Date(Date.now() - 60 * 60_000).toISOString(), stale: false,
    };
    localStorage.setItem("deskpet:weather:1301", JSON.stringify(old));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    try {
      const w = await getWeather("1301", "KOTA JAKARTA");
      expect(w).toMatchObject({ tempC: 27, stale: true });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("offline tanpa cache -> null (UI tampil pesan, bukan crash)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    try {
      expect(await getWeather("9999", "KOTA entah")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
