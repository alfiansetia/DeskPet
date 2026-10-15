/** Companion model untuk multi-pet (opsi B: 1 window Tauri per companion).
 *
 * Bedakan:
 * - `Character` (template tampilan): species + palette, murah untuk varian warna.
 * - `Companion` (instance yang jalan): id unik + window sendiri + state/stats/role sendiri.
 *
 * Window mapping (Rust `companions` module mirror):
 * - id "main"  -> window label "pet" (primary, backward-compat)
 * - id lain    -> window label `pet-${id}`
 */
import { characterIdFor, isPetSpecies, type PetSpecies } from "./species";

export const MAIN_COMPANION_ID = "main";
export const MAX_COMPANIONS = 5;

/** Tugas presenter saat event pusat datang (scheduler/prayer/timer tunggal). */
export type CompanionRole = "all" | "reminder" | "prayer" | "timer" | "decor";

export const COMPANION_ROLES: { id: CompanionRole; name: string; desc: string }[] = [
  { id: "all", name: "Serba bisa", desc: "Menampilkan semua alert" },
  { id: "reminder", name: "Pengingat", desc: "Alert pengingat & tugas" },
  { id: "prayer", name: "Sholat", desc: "Alert jadwal sholat" },
  { id: "timer", name: "Timer", desc: "Alert timer selesai" },
  { id: "decor", name: "Hiasan", desc: "Hanya jalan-jalan, tanpa alert" },
];

export function isCompanionRole(v: unknown): v is CompanionRole {
  return v === "all" || v === "reminder" || v === "prayer" || v === "timer" || v === "decor";
}

export interface Companion {
  id: string;
  name: string;
  species: PetSpecies;
  paletteId: string;
  customColor: string;
  scale: number;
  role: CompanionRole;
  /** Tampilkan pill suhu di window pet ini (default true; global weatherEnabled tetap berlaku). */
  showTemp: boolean;
  /** Tampilkan pill mini countdown sholat di window pet ini (default true). */
  showMini: boolean;
  /** Pemalu: menjauh saat kursor hover (default false). Diatur per karakter. */
  shy: boolean;
  createdAt: string;
}

const ID_RE = /^(main|c_[a-z0-9]{1,32})$/;

export function isCompanionId(v: unknown): boolean {
  return typeof v === "string" && ID_RE.test(v);
}

/** Label window Tauri untuk satu companion. Mirror Rust `window_label_for`. */
export function windowLabelFor(id: string): string {
  return id === MAIN_COMPANION_ID ? "pet" : `pet-${id}`;
}

/** Companion id pemilik window ini dari label window Tauri. */
export function companionIdFromWindowLabel(label: string): string {
  if (label === "pet") return MAIN_COMPANION_ID;
  if (label.startsWith("pet-")) {
    const id = label.slice(4);
    if (isCompanionId(id)) return id;
  }
  return MAIN_COMPANION_ID;
}

export function uidCompanion(): string {
  return `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function clampScale(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.min(2, Math.max(0.5, Math.round(v * 10) / 10))
    : 1;
}

const KNOWN_PALETTES = ["lavender", "sky", "matcha", "peach", "rose", "midnight", "custom"];

/** Validasi + default satu companion mentah (tidak pernah throw). */
export function normalizeCompanion(raw: unknown, fallbackId = MAIN_COMPANION_ID): Companion {
  const r = (raw ?? {}) as Partial<Companion>;
  const id = isCompanionId(r.id) ? (r.id as string) : fallbackId;
  const species: PetSpecies = isPetSpecies(r.species) ? r.species : "cat";
  const paletteId = typeof r.paletteId === "string" && KNOWN_PALETTES.includes(r.paletteId)
    ? r.paletteId
    : "lavender";
  const customColor = typeof r.customColor === "string" && /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(r.customColor.trim())
    ? r.customColor.trim()
    : "";
  const name = typeof r.name === "string" && r.name.trim().length > 0
    ? r.name.trim().slice(0, 24)
    : defaultNameFor(species, id);
  return {
    id,
    name,
    species,
    paletteId,
    customColor,
    scale: clampScale(r.scale),
    role: isCompanionRole(r.role) ? r.role : "all",
    showTemp: typeof r.showTemp === "boolean" ? r.showTemp : true,
    showMini: typeof r.showMini === "boolean" ? r.showMini : true,
    shy: r.shy === true,
    createdAt: typeof r.createdAt === "string" && !Number.isNaN(Date.parse(r.createdAt))
      ? r.createdAt
      : new Date().toISOString(),
  };
}

export function normalizeCompanionList(raw: unknown): Companion[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Companion[] = [];
  for (const item of raw) {
    const c = normalizeCompanion(item, seen.has(MAIN_COMPANION_ID) ? uidCompanion() : MAIN_COMPANION_ID);
    if (seen.has(c.id)) c.id = uidCompanion();
    seen.add(c.id);
    out.push(c);
    if (out.length >= MAX_COMPANIONS) break;
  }
  return out;
}

export function defaultNameFor(species: PetSpecies, id: string): string {
  const label = species === "cat" ? "Kucing" : species === "snake" ? "Ular" : species === "frog" ? "Kodok" : species === "owl" ? "Hantu" : "Pinpin";
  if (id === MAIN_COMPANION_ID) {
    return label;
  }
  return `${label} ${id.slice(2, 6)}`;
}

/** Migrasi simpanan single-pet lama -> daftar companions (pet lama jadi "main"). */
export function migrateFromLegacy(opts: {
  petSpecies?: unknown;
  petPaletteId?: unknown;
  petCustomColor?: unknown;
  petScale?: unknown;
}): Companion[] {
  const species: PetSpecies = isPetSpecies(opts.petSpecies) ? opts.petSpecies : "cat";
  const paletteId = typeof opts.petPaletteId === "string" && KNOWN_PALETTES.includes(opts.petPaletteId)
    ? opts.petPaletteId
    : "lavender";
  return [normalizeCompanion({
    id: MAIN_COMPANION_ID,
    name: defaultNameFor(species, MAIN_COMPANION_ID),
    species,
    paletteId,
    customColor: typeof opts.petCustomColor === "string" ? opts.petCustomColor : "",
    scale: clampScale(opts.petScale),
    role: "all",
    createdAt: new Date().toISOString(),
  })];
}

/** ID kanonis karakter (aset) untuk satu companion. */
export function characterIdForCompanion(c: Pick<Companion, "species">): string {
  return characterIdFor(c.species);
}

/**
 * Panggil `companions_spawn` dengan timeout.
 *
 * Konteks: backend membangun window di thread terpisah (wry#583 — build
 * di sync command worker deadlock di Windows). Timeout di sini murni jaring
 * pengaman: bila invoke tidak kembali dalam batas waktu, laporkan sebagai
 * timeout agar UI tidak menggantung selamanya dan boot tetap jalan.
 * Best-effort, tidak pernah throw.
 */
export async function spawnCompanionWindow(
  id: string,
  timeoutMs = 15_000,
): Promise<{ ok: boolean; timeout: boolean; existed?: boolean; error?: string }> {
  try {
    const mod = await import("@tauri-apps/api/core").catch(() => null);
    const invoke = (mod as { invoke?: (cmd: string, args?: unknown) => Promise<unknown> } | null)?.invoke;
    if (!invoke) return { ok: false, timeout: false, error: "no-backend" };
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const res = (await Promise.race([
        invoke("companions_spawn", { id }),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), timeoutMs);
        }),
      ])) as { existed?: boolean } | null;
      if (!res) return { ok: false, timeout: true };
      return { ok: true, timeout: false, existed: res.existed };
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (e) {
    return { ok: false, timeout: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Pilih presenter untuk satu event terpusat berdasarkan role.
 * - role "decor" tidak pernah dipilih.
 * - kecocokan role dulu, lalu fallback companion pertama (non-decor), lalu pertama.
 * - return null bila daftar kosong.
 */
export function resolvePresenterFor(
  list: Companion[],
  kind: "reminder" | "prayer" | "timer",
): Companion | null {
  if (list.length === 0) return null;
  const eligible = list.filter((c) => c.role !== "decor");
  const pool = eligible.length > 0 ? eligible : list;
  const direct = pool.find((c) => c.role === kind || c.role === "all");
  return direct ?? pool[0] ?? null;
}

/** Delay awal wander (ms) dari hash id agar N pet tidak gerak sinkron. 0 untuk "main". */
export function phaseDelayMsFor(id: string): number {
  if (id === MAIN_COMPANION_ID) return 0;
  return 400 + (hashStr(id) % 2400);
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Fase awal rotasi pill ambient (0/1) agar N pet tidak ganti barengan. */
export function slotPhaseFor(id: string): number {
  if (id === MAIN_COMPANION_ID) return 0;
  return hashStr(id) % 2;
}

/** Jitter periode rotasi pill (0–1499 ms) agar tidak sinkron permanen. */
export function slotPeriodJitterMsFor(id: string): number {
  if (id === MAIN_COMPANION_ID) return 0;
  return hashStr(`period:${id}`) % 1500;
}
