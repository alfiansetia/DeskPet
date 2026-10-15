/** Local-first persistent store (PRD §8). localStorage-backed; Rust/SQLite mirror planned. */
import { loadJSON, saveJSON } from "./storage";
import { notifyDataChanged } from "./sharedData";
import { nowUTC } from "./time";
import { characterIdFor, isPetSpecies, type PetSpecies } from "../features/pet/species";
import { normalizeStats, type PetStats } from "../features/pet/care";
import {
  MAIN_COMPANION_ID,
  MAX_COMPANIONS,
  migrateFromLegacy,
  normalizeCompanion,
  normalizeCompanionList,
  uidCompanion,
  type Companion,
  type CompanionRole,
} from "../features/pet/companions";

export type ReminderStatus = "active" | "completed" | "dismissed" | "snoozed";
export type RecurrenceRule = "none" | "daily" | "weekdays" | "weekly";
export interface Reminder {
  id: string; title: string; body?: string;
  dueAt: string; timezone: string; recurrence: RecurrenceRule;
  status: ReminderStatus; snoozeUntil?: string | null;
  lastTriggeredAt?: string | null; createdAt: string; updatedAt: string;
  /** Info display saja ("dibuat dari window X"). Single shared DB: TIDAK
   *  dipakai sebagai filter kepemilikan — semua window melihat data yang sama. */
  createdBy?: string | null;
}

export type TodoStatus = "open" | "in_progress" | "completed";
export interface Todo {
  id: string; title: string; description?: string;
  status: TodoStatus; priority: number; dueAt?: string | null;
  reminderId?: string | null; createdAt: string; updatedAt: string;
  completedAt?: string | null;
  /** Info display saja, lihat Reminder.createdBy. */
  createdBy?: string | null;
}

export interface Note {
  id: string; title: string; content: string;
  createdAt: string; updatedAt: string; deletedAt?: string | null;
  /** Info display saja, lihat Reminder.createdBy. */
  createdBy?: string | null;
}

export interface CalEvent {
  id: string; title: string; startAt: string; endAt: string;
  location?: string; source: "local" | "google";
  createdAt: string;
  /** Info display saja, lihat Reminder.createdBy. */
  createdBy?: string | null;
}

export interface Automation {
  id: string; name: string; summary: string;
  trigger: "weekday_morning" | "reminder_due" | "friday_review" | "before_event" | "task_nudge";
  enabled: boolean; createdAt: string; lastRunAt?: string | null;
}

export type PermissionClass =
  | "read_local" | "write_local" | "scheduled" | "external_read" | "external_write" | "high_risk";

export interface AuditEntry {
  id: string; actionId: string; source: string;
  status: "executed" | "previewed" | "rejected" | "confirmed";
  confirmationRequired: boolean; createdAt: string;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Normalisasi info `createdBy`: "main" / `c_*` valid dipertahankan,
 *  nilai asing -> null (data lama tanpa field -> null). Tidak pernah throw. */
export function normalizeCreatedBy(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, 40);
  if (s === MAIN_COMPANION_ID) return s;
  if (/^c_[a-z0-9]{1,32}$/.test(s)) return s;
  return null;
}

const K = {
  reminders: "deskpet:reminders",
  todos: "deskpet:todos",
  notes: "deskpet:notes",
  events: "deskpet:events",
  automations: "deskpet:automations",
  audit: "deskpet:audit",
  settings: "deskpet:settings",
  companions: "deskpet:companions",
};

export type WanderPace = "random" | "slow" | "normal" | "fast";
export type WanderDirection = "random" | "horizontal" | "vertical" | "edges";

export interface DeskSettings {
  alwaysOnTop: boolean; reducedMotion: boolean;
  soundMuted: boolean; speechMuted: boolean;
  wanderEnabled: boolean;
  wanderPace: WanderPace;
  wanderDirection: WanderDirection;
  quietHoursEnabled: boolean;
  quietStart: number; quietEnd: number;
  characterId: string; telemetryEnabled: false;
  petSpecies: PetSpecies;
  petPaletteId: string; petCustomColor: string;
  petScale: number;
  prayerEnabled: boolean;
  prayerCityId: string;
  prayerCityName: string;
  prayerAdzanEnabled: boolean;
  prayerReminderMins: number;
  prayerMiniEnabled: boolean;
  prayerBubbleEnabled: boolean;
  timerBadgeEnabled: boolean;
  timerDoneAlertEnabled: boolean;
  centerOnAlert: boolean;
  autoStart: boolean;
  weatherEnabled: boolean;
  tempBubbleEnabled: boolean;
  pettingTotal: number;
  activeHat: string;
  petStats: PetStats;
}

export const DEFAULT_SETTINGS: DeskSettings = {
  alwaysOnTop: true, reducedMotion: false,
  soundMuted: false, speechMuted: true, // TTS default MATI (opt-in via checkbox; bunyi efek tetap on)
  wanderEnabled: true,
  wanderPace: "random",
  wanderDirection: "random",
  quietHoursEnabled: true,
  quietStart: 22, quietEnd: 7,
  characterId: "deskpet.cat", telemetryEnabled: false,
  petSpecies: "cat" as PetSpecies,
  petPaletteId: "lavender", petCustomColor: "",
  petScale: 1,
  prayerEnabled: true,
  prayerCityId: "1301",
  prayerCityName: "KOTA JAKARTA",
  prayerAdzanEnabled: true,
  prayerReminderMins: 10,
  prayerMiniEnabled: true,
  prayerBubbleEnabled: true,
  timerBadgeEnabled: true,
  timerDoneAlertEnabled: true,
  centerOnAlert: true,
  autoStart: false,
  weatherEnabled: true,
  tempBubbleEnabled: true,
  pettingTotal: 0,
  activeHat: "none",
  petStats: { hunger: 100, mood: 100, energy: 100, updatedAt: new Date(0).toISOString() },
};

/** Validate + fill defaults for a raw settings object (local cache or backend blob). */
export function normalizeSettings(raw: Partial<DeskSettings>): DeskSettings {
  const scale = typeof raw.petScale === "number" && Number.isFinite(raw.petScale)
    ? Math.min(2, Math.max(0.5, raw.petScale))
    : 1;
  const wanderPace = ["random", "slow", "normal", "fast"].includes(raw.wanderPace as string)
    ? (raw.wanderPace as WanderPace)
    : "random";
  const wanderDirection = ["random", "horizontal", "vertical", "edges"].includes(raw.wanderDirection as string)
    ? (raw.wanderDirection as WanderDirection)
    : "random";
  const prayerReminderMins = typeof raw.prayerReminderMins === "number"
    ? Math.min(30, Math.max(0, raw.prayerReminderMins))
    : DEFAULT_SETTINGS.prayerReminderMins;
  const knownPalettes = ["lavender", "sky", "matcha", "peach", "rose", "midnight", "custom"];
  let petPaletteId = typeof raw.petPaletteId === "string" && knownPalettes.includes(raw.petPaletteId)
    ? raw.petPaletteId
    : DEFAULT_SETTINGS.petPaletteId;
  const petCustomColor = typeof raw.petCustomColor === "string" && /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(raw.petCustomColor.trim())
    ? raw.petCustomColor.trim()
    : "";
  // Spesies: valid atau default kucing. Simpanan lama tanpa field ini -> "cat".
  const petSpecies: PetSpecies = isPetSpecies(raw.petSpecies) ? raw.petSpecies : "cat";
  // Migrasi satu spesies: paket lama dihapus, petakan ke palette terdekat.
  // Hanya bila user belum punya pilihan palette sendiri.
  const legacyId = typeof raw.characterId === "string" ? raw.characterId : "";
  const hasOwnPalette = typeof raw.petPaletteId === "string" && knownPalettes.includes(raw.petPaletteId);
  if (!hasOwnPalette) {
    if (legacyId === "deskpet.cat.orange") petPaletteId = "peach";
    else if (legacyId === "deskpet.cat.black") petPaletteId = "midnight";
    else petPaletteId = DEFAULT_SETTINGS.petPaletteId;
  }
  const characterId = characterIdFor(petSpecies);
  const centerOnAlert = typeof raw.centerOnAlert === "boolean" ? raw.centerOnAlert : true;
  const autoStart = typeof raw.autoStart === "boolean" ? raw.autoStart : false;
  const weatherEnabled = typeof raw.weatherEnabled === "boolean" ? raw.weatherEnabled : true;
  const tempBubbleEnabled = typeof raw.tempBubbleEnabled === "boolean" ? raw.tempBubbleEnabled : true;
  const pettingTotal = typeof raw.pettingTotal === "number" && Number.isFinite(raw.pettingTotal) && raw.pettingTotal >= 0
    ? Math.floor(raw.pettingTotal)
    : 0;
  const activeHat = typeof raw.activeHat === "string" && raw.activeHat.length > 0 ? raw.activeHat : "none";
  const petStats = normalizeStats(raw.petStats);
  return { ...DEFAULT_SETTINGS, ...raw, telemetryEnabled: false as const, petScale: scale, wanderPace, wanderDirection, prayerReminderMins, petSpecies, petPaletteId, petCustomColor, characterId, centerOnAlert, autoStart, weatherEnabled, tempBubbleEnabled, pettingTotal, activeHat, petStats };
}

export function loadSettings(): DeskSettings {
  return normalizeSettings(loadJSON<Partial<DeskSettings>>(K.settings, {}));
}
export function saveSettings(s: DeskSettings): void {
  saveJSON(K.settings, { ...s, telemetryEnabled: false });
}

export const store = {
  reminders: {
    key: K.reminders,
    all(): Reminder[] { return loadJSON<Reminder[]>(K.reminders, []); },
    save(v: Reminder[]) { saveJSON(K.reminders, v); notifyDataChanged("reminders"); },
  },
  todos: {
    key: K.todos,
    all(): Todo[] { return loadJSON<Todo[]>(K.todos, []); },
    save(v: Todo[]) { saveJSON(K.todos, v); notifyDataChanged("todos"); },
  },
  notes: {
    key: K.notes,
    all(): Note[] { return loadJSON<Note[]>(K.notes, []); },
    save(v: Note[]) { saveJSON(K.notes, v); notifyDataChanged("notes"); },
  },
  events: {
    key: K.events,
    all(): CalEvent[] { return loadJSON<CalEvent[]>(K.events, []); },
    save(v: CalEvent[]) { saveJSON(K.events, v); notifyDataChanged("events"); },
  },
  automations: {
    key: K.automations,
    all(): Automation[] { return loadJSON<Automation[]>(K.automations, defaultAutomations()); },
    save(v: Automation[]) { saveJSON(K.automations, v); notifyDataChanged("automations"); },
  },
  audit: {
    key: K.audit,
    all(): AuditEntry[] { return loadJSON<AuditEntry[]>(K.audit, []); },
    push(e: AuditEntry) {
      const all = loadJSON<AuditEntry[]>(K.audit, []);
      all.unshift(e);
      saveJSON(K.audit, all.slice(0, 200));
      notifyDataChanged("audit");
    },
    clear() { saveJSON(K.audit, []); notifyDataChanged("audit"); },
  },
  companions: {
    key: K.companions,
    all(): Companion[] { return loadJSON<Companion[]>(K.companions, []); },
    save(v: Companion[]) { saveJSON(K.companions, v.slice(0, MAX_COMPANIONS)); },
  },
};

/** Muat daftar companion; migrasi dari settings single-pet lama bila kosong. */
export function loadCompanions(fallbackLegacy?: {
  petSpecies?: unknown; petPaletteId?: unknown; petCustomColor?: unknown; petScale?: unknown;
}): Companion[] {
  const raw = store.companions.all();
  const list = normalizeCompanionList(raw);
  if (list.length > 0) return list;
  const migrated = migrateFromLegacy(fallbackLegacy ?? loadSettingsLegacyFields());
  store.companions.save(migrated);
  return migrated;
}

function loadSettingsLegacyFields(): Record<string, unknown> {
  try {
    return loadJSON<Record<string, unknown>>(K.settings, {});
  } catch {
    return {};
  }
}

export function saveCompanions(list: Companion[]): Companion[] {
  const norm = normalizeCompanionList(list);
  store.companions.save(norm);
  return norm;
}

/** Tambah companion baru (validasi max). Return null bila penuh. */
export function addCompanion(input: Partial<Companion>): Companion | null {
  const list = loadCompanions();
  if (list.length >= MAX_COMPANIONS) return null;
  const c = normalizeCompanion({ ...input, id: uidCompanion(), createdAt: new Date().toISOString() }, uidCompanion());
  // normalizeCompanion keeps a valid provided id; force fresh uid di sini.
  const fresh: Companion = { ...c, id: uidCompanion() };
  const next = saveCompanions([...list, fresh]);
  return next.find((x) => x.id === fresh.id) ?? null;
}

export function removeCompanion(id: string): Companion[] {
  if (id === MAIN_COMPANION_ID) return loadCompanions(); // primary tidak bisa dihapus
  return saveCompanions(loadCompanions().filter((c) => c.id !== id));
}

export function updateCompanion(id: string, patch: Partial<Companion>): Companion[] {
  return saveCompanions(
    loadCompanions().map((c) => (c.id === id ? normalizeCompanion({ ...c, ...patch, id }) : c)),
  );
}

export type { Companion, CompanionRole };
export { MAIN_COMPANION_ID, MAX_COMPANIONS };

export function defaultAutomations(): Automation[] {
  const t = nowUTC();
  return [
    { id: "auto_morning", name: "Ringkasan pagi", summary: "Tiap Senin–Jumat 09:00: tampilkan tugas hari ini.", trigger: "weekday_morning", enabled: true, createdAt: t },
    { id: "auto_speak", name: "Bacakan pengingat", summary: "Saat pengingat jatuh tempo: notifikasi + animasi + TTS (jika diizinkan).", trigger: "reminder_due", enabled: true, createdAt: t },
    { id: "auto_friday", name: "Review Jumat", summary: "Tiap Jumat 16:00: buat task review mingguan.", trigger: "friday_review", enabled: false, createdAt: t },
    { id: "auto_task_nudge", name: "Ingatkan tugas terbuka", summary: "Tiap 13:00 & 17:30 bila ada tugas belum selesai (maks 1x/slot/hari).", trigger: "task_nudge", enabled: true, createdAt: t },
  ];
}

/**
 * Migrasi otomasi: user lama yang simpanannya belum punya id default baru
 * (mis. auto_task_nudge) tetap kebagian tanpa menghapus setting mereka.
 * Idempotent, dipanggil sekali saat boot primary.
 */
export function ensureAutomationDefaults(): void {
  const cur = store.automations.all();
  const have = new Set(cur.map((a) => a.id));
  const missing = defaultAutomations().filter((d) => !have.has(d.id));
  if (missing.length === 0) return;
  store.automations.save([...cur, ...missing]);
}

/** Full local backup (explicit user action, PRD §5.4). */
export function exportBackup(): string {
  let apiconfig: unknown = null;
  try { apiconfig = loadJSON("deskpet:apiwatch", null); } catch { apiconfig = null; }
  return JSON.stringify({
    app: "deskpet", version: 2, exportedAt: nowUTC(),
    reminders: store.reminders.all(), todos: store.todos.all(),
    notes: store.notes.all(), events: store.events.all(),
    automations: store.automations.all(), settings: loadSettings(),
    companions: loadCompanions(), apiconfig,
  }, null, 2);
}

export function importBackup(json: string): { ok: boolean; error?: string } {
  try {
    const d = JSON.parse(json);
    if (d.app !== "deskpet") return { ok: false, error: "Bukan file backup DeskPet." };
    if (Array.isArray(d.reminders)) store.reminders.save(d.reminders);
    if (Array.isArray(d.todos)) store.todos.save(d.todos);
    if (Array.isArray(d.notes)) store.notes.save(d.notes);
    if (Array.isArray(d.events)) store.events.save(d.events);
    if (Array.isArray(d.automations)) store.automations.save(d.automations);
    if (d.settings && typeof d.settings === "object") saveSettings({ ...DEFAULT_SETTINGS, ...d.settings, telemetryEnabled: false });
    if (Array.isArray(d.companions)) saveCompanions(normalizeCompanionList(d.companions));
    if (d.apiconfig && typeof d.apiconfig === "object") saveJSON("deskpet:apiwatch", d.apiconfig);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
