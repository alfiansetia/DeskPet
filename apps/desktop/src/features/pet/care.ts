/** Tamagotchi-lite: lapar/mood/energi 0-100 meluruh terhadap waktu.
 * Murni (tanpa DOM/storage) agar gampang di-test; persist di DeskSettings.
 */
export interface PetStats {
  hunger: number;
  mood: number;
  energy: number;
  updatedAt: string; // ISO
}

export type CareNeed = "hungry" | "lonely" | "tired";

const HUNGER_PER_HOUR = 8;
const MOOD_PER_HOUR = 5;
const ENERGY_PER_HOUR = 6;
const SLEEP_REGEN_PER_HOUR = 12;

const clamp01 = (v: number) => Math.min(100, Math.max(0, Math.round(v)));

export function fullStats(nowMs = Date.now()): PetStats {
  return { hunger: 100, mood: 100, energy: 100, updatedAt: new Date(nowMs).toISOString() };
}

export function normalizeStats(raw: unknown, nowMs = Date.now()): PetStats {
  const r = (raw ?? {}) as Partial<PetStats>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 100);
  const t = typeof r.updatedAt === "string" && !Number.isNaN(Date.parse(r.updatedAt))
    ? r.updatedAt
    : new Date(nowMs).toISOString();
  return { hunger: num(r.hunger), mood: num(r.mood), energy: num(r.energy), updatedAt: t };
}

/** Luruhkan stat ke waktu now. Tidur memulihkan energi (bukan meluruhkan). */
export function decayStats(s: PetStats, nowMs = Date.now(), sleeping = false): PetStats {
  const elapsedH = Math.max(0, (nowMs - Date.parse(s.updatedAt)) / 3_600_000);
  if (elapsedH <= 0) return { ...s };
  return {
    hunger: clamp01(s.hunger - HUNGER_PER_HOUR * elapsedH),
    mood: clamp01(s.mood - MOOD_PER_HOUR * elapsedH),
    energy: clamp01(s.energy + (sleeping ? SLEEP_REGEN_PER_HOUR : -ENERGY_PER_HOUR) * elapsedH),
    updatedAt: new Date(nowMs).toISOString(),
  };
}

export function feedStats(s: PetStats, nowMs = Date.now()): PetStats {
  return { hunger: 100, mood: clamp01(s.mood + 10), energy: clamp01(s.energy + 5), updatedAt: new Date(nowMs).toISOString() };
}

export function playStats(s: PetStats, nowMs = Date.now()): PetStats {
  return {
    hunger: clamp01(s.hunger - 8),
    mood: 100,
    energy: clamp01(s.energy - 8),
    updatedAt: new Date(nowMs).toISOString(),
  };
}

/** Kebutuhan yang di bawah ambang (untuk peringatan sekali-per-transisi). */
export function needsCare(s: PetStats): CareNeed[] {
  const out: CareNeed[] = [];
  if (s.hunger < 25) out.push("hungry");
  if (s.mood < 25) out.push("lonely");
  if (s.energy < 15) out.push("tired");
  return out;
}
