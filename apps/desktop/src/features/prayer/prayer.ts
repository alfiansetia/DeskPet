/** Jadwal sholat local-first (PRD §5.2 eksternal read opt-in).
 * Sumber utama: MyQuran v2 (Kemenag, tanpa API key).
 * Fallback global: Aladhan (method=20 Kemenag RI).
 * Cache harian di localStorage agar tetap offline setelah 1x fetch.
 */
import { loadJSON, saveJSON } from "../../lib/storage";

export interface PrayerDay {
  date: string; // YYYY-MM-DD (lokal)
  cityId: string;
  cityName: string;
  imsak: string;
  subuh: string;
  terbit: string;
  dhuha: string;
  dzuhur: string;
  ashar: string;
  maghrib: string;
  isya: string;
  source: "myquran" | "aladhan" | "cache";
}

export interface PrayerCity { id: string; lokasi: string }

export const PRAYER_NAMES = ["Imsak", "Subuh", "Terbit", "Dhuha", "Dzuhur", "Ashar", "Maghrib", "Isya"] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];

/** 5 waktu wajib yang memicu adzan/bubble. */
export const OBLIGATORY: PrayerName[] = ["Subuh", "Dzuhur", "Ashar", "Maghrib", "Isya"];

export const POPULAR_CITIES: PrayerCity[] = [
  { id: "1301", lokasi: "KOTA JAKARTA" },
  { id: "1225", lokasi: "KOTA DEPOK" },
  { id: "1221", lokasi: "KOTA BEKASI" },
  { id: "1219", lokasi: "KOTA BANDUNG" },
  { id: "1433", lokasi: "KOTA SEMARANG" },
  { id: "1505", lokasi: "KOTA YOGYAKARTA" },
  { id: "1638", lokasi: "KOTA SURABAYA" },
  { id: "0228", lokasi: "KOTA MEDAN" },
  { id: "0314", lokasi: "KOTA PADANG" },
  { id: "0816", lokasi: "KOTA PALEMBANG" },
  { id: "2622", lokasi: "KOTA MAKASSAR" },
  { id: "1709", lokasi: "KOTA DENPASAR" },
  { id: "1810", lokasi: "KOTA MATARAM" },
  { id: "2813", lokasi: "KOTA PALU" },
];

const dayKey = (cityId: string, ymd: string) => `deskpet:prayer:${cityId}:${ymd}`;
const CITY_CACHE = "deskpet:prayer:cities";
const FIRED_KEY = "deskpet:prayer:fired";

export function toYMD(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "17:49" + tanggal lokal -> Date lokal. */
export function toDateForTime(ymd: string, hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  const [y, mo, d] = ymd.split("-").map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, Number(m[1]), Number(m[2]), 0);
}

export function timeOf(day: PrayerDay, name: PrayerName): string {
  switch (name) {
    case "Imsak": return day.imsak;
    case "Subuh": return day.subuh;
    case "Terbit": return day.terbit;
    case "Dhuha": return day.dhuha;
    case "Dzuhur": return day.dzuhur;
    case "Ashar": return day.ashar;
    case "Maghrib": return day.maghrib;
    case "Isya": return day.isya;
  }
}

/** Waktu sholat berikutnya (termasuk yang sudah lewat <60 dtk agar langsung bunyi). */
export function getNextPrayer(day: PrayerDay, now: Date): { name: PrayerName; at: Date } | null {
  const cands = PRAYER_NAMES.map((name) => ({ name, at: toDateForTime(day.date, timeOf(day, name)) }))
    .filter((c): c is { name: PrayerName; at: Date } => !!c.at)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const c of cands) {
    if (c.at.getTime() >= now.getTime() - 60_000) return c;
  }
  return null;
}

/** Pengingat H-X menit: kembalikan prayer yang akan tiba dalam window. */
export function getUpcomingReminder(
  day: PrayerDay, now: Date, beforeMins: number,
): { name: PrayerName; at: Date; diffMs: number } | null {
  if (beforeMins <= 0) return null;
  for (const name of OBLIGATORY) {
    const at = toDateForTime(day.date, timeOf(day, name));
    if (!at) continue;
    const diff = at.getTime() - now.getTime();
    if (diff > 0 && diff <= beforeMins * 60_000 + 60_000) return { name, at, diffMs: diff };
  }
  return null;
}

/** Countdown presisi menit tanpa detik (pill pendek): "45 mnt", "1 jam", "1 jam 2 mnt". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0 mnt";
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} mnt`;
  return m === 0 ? `${h} jam` : `${h} jam ${m} mnt`;
}

export function alertKey(ymd: string, name: string): string {
  return `${ymd}|${name}`;
}

export function wasFired(key: string): boolean {
  const all = loadJSON<string[]>(FIRED_KEY, []);
  return all.includes(key);
}

export function markFired(key: string): void {
  const all = loadJSON<string[]>(FIRED_KEY, []);
  if (!all.includes(key)) saveJSON(FIRED_KEY, [key, ...all].slice(0, 60));
}

function parseMyQuran(json: unknown, cityId: string, fallbackName: string): PrayerDay | null {
  try {
    const d = json as { status: boolean; data?: { lokasi?: string; jadwal?: Record<string, string> } };
    const j = d?.data?.jadwal;
    if (!j) return null;
    return {
      date: j.date ?? "",
      cityId,
      cityName: d.data?.lokasi ?? fallbackName,
      imsak: j.imsak ?? "--:--",
      subuh: j.subuh ?? "--:--",
      terbit: j.terbit ?? "--:--",
      dhuha: j.dhuha ?? "--:--",
      dzuhur: j.dzuhur ?? "--:--",
      ashar: j.ashar ?? "--:--",
      maghrib: j.maghrib ?? "--:--",
      isya: j.isya ?? "--:--",
      source: "myquran",
    };
  } catch {
    return null;
  }
}

async function fetchMyQuran(cityId: string, cityName: string, d: Date): Promise<PrayerDay | null> {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const r = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${cityId}/${y}/${m}/${day}`, { signal: ctrl.signal });
    if (!r.ok) return null;
    const parsed = parseMyQuran(await r.json(), cityId, cityName);
    if (parsed && !parsed.date) parsed.date = toYMD(d);
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchAladhanFallback(cityName: string, d: Date): Promise<PrayerDay | null> {
  try {
    const dd = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    const city = cityName.replace(/^KOTA\s+|^KAB\.\s+/i, "") || "Jakarta";
    const r = await fetch(
      `https://api.aladhan.com/v1/timingsByCity/${dd}?city=${encodeURIComponent(city)}&country=Indonesia&method=20`,
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: { timings?: Record<string, string> } };
    const t = j?.data?.timings;
    if (!t) return null;
    const cut = (s: string) => s.slice(0, 5);
    return {
      date: toYMD(d), cityId: "aladhan", cityName: city.toUpperCase(),
      imsak: cut(t.Imsak ?? ""), subuh: cut(t.Fajr ?? ""), terbit: cut(t.Sunrise ?? ""),
      dhuha: cut(t.Sunrise ?? ""), dzuhur: cut(t.Dhuhr ?? ""), ashar: cut(t.Asr ?? ""),
      maghrib: cut(t.Maghrib ?? ""), isya: cut(t.Isha ?? ""), source: "aladhan",
    };
  } catch {
    return null;
  }
}

/** Ambil jadwal hari ini: cache dulu, refresh background dari network. */
export async function getPrayerDay(cityId: string, cityName: string, d = new Date()): Promise<PrayerDay | null> {
  const ymd = toYMD(d);
  const cached = loadJSON<PrayerDay | null>(dayKey(cityId, ymd), null);
  // Tetap coba network (best-effort), tapi jangan blokir UI lama.
  const live = await fetchMyQuran(cityId, cityName, d);
  if (live) {
    saveJSON(dayKey(cityId, ymd), live);
    pushDurablePrayerDay(cityId, ymd, live);
    return live;
  }
  if (cached) return { ...cached, source: "cache" };
  const fb = await fetchAladhanFallback(cityName, d);
  if (fb) {
    saveJSON(dayKey(cityId, ymd), fb);
    pushDurablePrayerDay(cityId, ymd, fb);
    return fb;
  }
  return null;
}

export function getCachedPrayerDay(cityId: string, d = new Date()): PrayerDay | null {
  return loadJSON<PrayerDay | null>(dayKey(cityId, toYMD(d)), null);
}

/** Cache instan saat boot: localStorage dulu, lalu file tahan lama backend.
 * Local-first: pill countdown langsung tampil tanpa menunggu network.
 * Ditemukan null bila belum pernah tersimpan (fresh install / kota baru). */
export async function getInstantPrayerDay(cityId: string, d = new Date()): Promise<PrayerDay | null> {
  const ymd = toYMD(d);
  const local = getCachedPrayerDay(cityId, d);
  if (local && local.date === ymd) return local;
  const durable = await pullDurablePrayerDay(cityId, ymd);
  if (durable) {
    try { saveJSON(dayKey(cityId, ymd), durable); } catch { /* cache lokal opsional */ }
    return durable;
  }
  return local;
}

/** Mirror tahan lama via file app-data Rust (best-effort; diam di web preview). */
async function pullDurablePrayerDay(cityId: string, ymd: string): Promise<PrayerDay | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const raw = await invoke<string | null>("prayer_cache_get", { cityId, ymd });
    if (!raw) return null;
    const p = JSON.parse(raw) as PrayerDay;
    if (!p || typeof p !== "object" || p.date !== ymd) return null;
    return p;
  } catch {
    return null;
  }
}

export function pushDurablePrayerDay(cityId: string, ymd: string, day: PrayerDay): void {
  try {
    void import("@tauri-apps/api/core")
      .then(({ invoke }) => (invoke("prayer_cache_put", { cityId, ymd, json: JSON.stringify(day) }) as Promise<unknown>)
        .catch(() => { /* best-effort */ }));
  } catch {
    /* backend tidak tersedia (web preview) */
  }
}

export async function fetchCities(): Promise<PrayerCity[]> {
  const cached = loadJSON<PrayerCity[]>(CITY_CACHE, []);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    const r = await fetch("https://api.myquran.com/v2/sholat/kota/semua", { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return cached.length ? cached : POPULAR_CITIES;
    const j = (await r.json()) as { data?: PrayerCity[] };
    if (Array.isArray(j.data) && j.data.length > 0) {
      saveJSON(CITY_CACHE, j.data);
      return j.data;
    }
    return cached.length ? cached : POPULAR_CITIES;
  } catch {
    return cached.length ? cached : POPULAR_CITIES;
  }
}

/** Bunyi adzan sederhana offline (WebAudio beep pattern). Tidak pakai file eksternal. */
export function playAdzanBeep(times = 3): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = i % 2 === 0 ? 523.25 : 659.25;
      const start = t0 + i * 0.55;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.25, start + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(start);
      o.stop(start + 0.55);
    }
    setTimeout(() => void ctx.close(), times * 600 + 400);
  } catch {
    /* audio tidak tersedia — abaikan, TTS/toast tetap jalan */
  }
}
