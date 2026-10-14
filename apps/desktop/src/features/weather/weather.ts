/** Cuaca local-first via Open-Meteo (gratis, tanpa API key, tanpa akun).
 * Kota dipakai ulang dari pilihan jadwal sholat (prayerCityId/prayerCityName).
 * Cache: hasil geocoding tahan lama, cuaca 15 menit -> tetap tampil offline.
 */
import { loadJSON, saveJSON } from "../../lib/storage";
import type { IconName } from "../../components/Icon";

export interface WeatherNow {
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windKph: number;
  code: number;
  label: string;
  icon: IconName;
  cityLabel: string;
  fetchedAt: string; // ISO
  stale: boolean; // true = dari cache basi (offline)
}

export const WEATHER_TTL_MS = 15 * 60_000;

/** Koordinat tengah kota-kota populer (cukup untuk cuaca level kota). */
export const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  "1301": { lat: -6.2, lon: 106.85 }, // KOTA JAKARTA
  "1225": { lat: -6.39, lon: 106.82 }, // KOTA DEPOK
  "1221": { lat: -6.24, lon: 106.99 }, // KOTA BEKASI
  "1219": { lat: -6.92, lon: 107.61 }, // KOTA BANDUNG
  "1433": { lat: -6.99, lon: 110.42 }, // KOTA SEMARANG
  "1505": { lat: -7.8, lon: 110.36 }, // KOTA YOGYAKARTA
  "1638": { lat: -7.26, lon: 112.75 }, // KOTA SURABAYA
  "0228": { lat: 3.59, lon: 98.67 }, // KOTA MEDAN
  "0314": { lat: -0.95, lon: 100.35 }, // KOTA PADANG
  "0816": { lat: -2.99, lon: 104.76 }, // KOTA PALEMBANG
  "2622": { lat: -5.15, lon: 119.41 }, // KOTA MAKASSAR
  "1709": { lat: -8.67, lon: 115.22 }, // KOTA DENPASAR
  "1810": { lat: -8.58, lon: 116.12 }, // KOTA MATARAM
  "2813": { lat: -0.9, lon: 119.87 }, // KOTA PALU
};

const GEO_CACHE = "deskpet:weather:geo";
const nowKey = (cityId: string) => `deskpet:weather:${cityId}`;

/** Kode cuaca WMO -> label Indonesia + ikon. */
export function describeCode(code: number): { label: string; icon: IconName } {
  if (code === 0) return { label: "Cerah", icon: "sun" };
  if (code === 1) return { label: "Cerah berawan", icon: "cloud" };
  if (code === 2) return { label: "Berawan", icon: "cloud" };
  if (code === 3) return { label: "Mendung", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "Berkabut", icon: "cloud" };
  if (code >= 51 && code <= 57) return { label: "Gerimis", icon: "cloudRain" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Hujan", icon: "cloudRain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Salju", icon: "cloudRain" };
  if (code >= 95 && code <= 99) return { label: "Badai petir", icon: "zap" };
  return { label: "Berawan", icon: "cloud" };
}

export function cleanCityName(name: string): string {
  return name.replace(/^KOTA\s+|^KAB\.\s+/i, "").trim() || "Jakarta";
}

async function fetchJSON(url: string, timeoutMs = 12_000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    return (await r.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Koordinat kota: tabel dulu, geocoding bila tak dikenal (hasil di-cache). */
export async function resolveCoords(cityId: string, cityName: string): Promise<{ lat: number; lon: number } | null> {
  const known = CITY_COORDS[cityId];
  if (known) return known;
  const geoCache = loadJSON<Record<string, { lat: number; lon: number }>>(GEO_CACHE, {});
  if (geoCache[cityId]) return geoCache[cityId];
  const q = cleanCityName(cityName);
  const j = (await fetchJSON(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=id&format=json`,
  )) as { results?: { latitude: number; longitude: number }[] } | null;
  const first = j?.results?.[0];
  if (!first || !Number.isFinite(first.latitude) || !Number.isFinite(first.longitude)) return null;
  const c = { lat: first.latitude, lon: first.longitude };
  saveJSON(GEO_CACHE, { ...geoCache, [cityId]: c });
  return c;
}

function parseCurrent(json: unknown, cityLabel: string): Omit<WeatherNow, "cityLabel" | "fetchedAt" | "stale"> | null {
  try {
    const c = (json as { current?: Record<string, number> })?.current;
    if (!c || typeof c.temperature_2m !== "number") return null;
    const code = typeof c.weather_code === "number" ? c.weather_code : 3;
    const d = describeCode(code);
    return {
      tempC: Math.round(c.temperature_2m),
      feelsLikeC: Math.round(c.apparent_temperature ?? c.temperature_2m),
      humidity: Math.round(c.relative_humidity_2m ?? 0),
      windKph: Math.round((c.wind_speed_10m ?? 0) * 10) / 10,
      code,
      label: d.label,
      icon: d.icon,
    };
  } catch {
    return null;
  }
}

/** Cuaca kini: cache segar langsung dipakai (instan/offline), refresh bila basi. */
export async function getWeather(cityId: string, cityName: string, now = Date.now()): Promise<WeatherNow | null> {
  const cached = loadJSON<WeatherNow | null>(nowKey(cityId), null);
  if (cached && now - new Date(cached.fetchedAt).getTime() < WEATHER_TTL_MS) return cached;
  const coords = await resolveCoords(cityId, cityName);
  if (!coords) return cached ? { ...cached, stale: true } : null;
  const j = await fetchJSON(
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`,
  );
  const parsed = j ? parseCurrent(j, cleanCityName(cityName)) : null;
  if (parsed) {
    const fresh: WeatherNow = { ...parsed, cityLabel: cleanCityName(cityName), fetchedAt: new Date().toISOString(), stale: false };
    saveJSON(nowKey(cityId), fresh);
    return fresh;
  }
  return cached ? { ...cached, stale: true } : null;
}

/** Baca cache saja (paint instan tanpa network). */
export function getCachedWeather(cityId: string): WeatherNow | null {
  return loadJSON<WeatherNow | null>(nowKey(cityId), null);
}

/** Kelompok cuaca untuk reaksi pet: hujan / cerah / berawan. */
export function weatherGroup(code: number | undefined): "rain" | "clear" | "cloud" {
  if (code === undefined) return "cloud";
  const d = describeCode(code);
  if (d.icon === "cloudRain" || d.icon === "zap") return "rain";
  if (d.icon === "sun") return "clear";
  return "cloud";
}
