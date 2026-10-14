/** Local-first persistent store (PRD §8). localStorage-backed; Rust/SQLite mirror planned. */
import { loadJSON, saveJSON } from "./storage";
import { nowUTC } from "./time";

export type ReminderStatus = "active" | "completed" | "dismissed" | "snoozed";
export type RecurrenceRule = "none" | "daily" | "weekdays" | "weekly";
export interface Reminder {
  id: string; title: string; body?: string;
  dueAt: string; timezone: string; recurrence: RecurrenceRule;
  status: ReminderStatus; snoozeUntil?: string | null;
  lastTriggeredAt?: string | null; createdAt: string; updatedAt: string;
}

export type TodoStatus = "open" | "in_progress" | "completed";
export interface Todo {
  id: string; title: string; description?: string;
  status: TodoStatus; priority: number; dueAt?: string | null;
  reminderId?: string | null; createdAt: string; updatedAt: string;
  completedAt?: string | null;
}

export interface Note {
  id: string; title: string; content: string;
  createdAt: string; updatedAt: string; deletedAt?: string | null;
}

export interface CalEvent {
  id: string; title: string; startAt: string; endAt: string;
  location?: string; source: "local" | "google";
  createdAt: string;
}

export interface Automation {
  id: string; name: string; summary: string;
  trigger: "weekday_morning" | "reminder_due" | "friday_review" | "before_event";
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

const K = {
  reminders: "deskpet:reminders",
  todos: "deskpet:todos",
  notes: "deskpet:notes",
  events: "deskpet:events",
  automations: "deskpet:automations",
  audit: "deskpet:audit",
  settings: "deskpet:settings",
};

export interface DeskSettings {
  alwaysOnTop: boolean; reducedMotion: boolean;
  soundMuted: boolean; speechMuted: boolean;
  wanderEnabled: boolean; quietHoursEnabled: boolean;
  quietStart: number; quietEnd: number;
  characterId: string; telemetryEnabled: false;
}

export const DEFAULT_SETTINGS: DeskSettings = {
  alwaysOnTop: true, reducedMotion: false,
  soundMuted: false, speechMuted: false,
  wanderEnabled: true, quietHoursEnabled: true,
  quietStart: 22, quietEnd: 7,
  characterId: "deskpet.cat.lavender", telemetryEnabled: false,
};

export function loadSettings(): DeskSettings {
  return { ...DEFAULT_SETTINGS, ...loadJSON<Partial<DeskSettings>>(K.settings, {}) };
}
export function saveSettings(s: DeskSettings): void {
  saveJSON(K.settings, { ...s, telemetryEnabled: false });
}

export const store = {
  reminders: {
    key: K.reminders,
    all(): Reminder[] { return loadJSON<Reminder[]>(K.reminders, []); },
    save(v: Reminder[]) { saveJSON(K.reminders, v); },
  },
  todos: {
    key: K.todos,
    all(): Todo[] { return loadJSON<Todo[]>(K.todos, []); },
    save(v: Todo[]) { saveJSON(K.todos, v); },
  },
  notes: {
    key: K.notes,
    all(): Note[] { return loadJSON<Note[]>(K.notes, []); },
    save(v: Note[]) { saveJSON(K.notes, v); },
  },
  events: {
    key: K.events,
    all(): CalEvent[] { return loadJSON<CalEvent[]>(K.events, []); },
    save(v: CalEvent[]) { saveJSON(K.events, v); },
  },
  automations: {
    key: K.automations,
    all(): Automation[] { return loadJSON<Automation[]>(K.automations, defaultAutomations()); },
    save(v: Automation[]) { saveJSON(K.automations, v); },
  },
  audit: {
    key: K.audit,
    all(): AuditEntry[] { return loadJSON<AuditEntry[]>(K.audit, []); },
    push(e: AuditEntry) {
      const all = loadJSON<AuditEntry[]>(K.audit, []);
      all.unshift(e);
      saveJSON(K.audit, all.slice(0, 200));
    },
  },
};

export function defaultAutomations(): Automation[] {
  const t = nowUTC();
  return [
    { id: "auto_morning", name: "Ringkasan pagi", summary: "Tiap Senin–Jumat 09:00: tampilkan tugas hari ini.", trigger: "weekday_morning", enabled: true, createdAt: t },
    { id: "auto_speak", name: "Bacakan pengingat", summary: "Saat pengingat jatuh tempo: notifikasi + animasi + TTS (jika diizinkan).", trigger: "reminder_due", enabled: true, createdAt: t },
    { id: "auto_friday", name: "Review Jumat", summary: "Tiap Jumat 16:00: buat task review mingguan.", trigger: "friday_review", enabled: false, createdAt: t },
  ];
}

/** Full local backup (explicit user action, PRD §5.4). */
export function exportBackup(): string {
  return JSON.stringify({
    app: "deskpet", version: 1, exportedAt: nowUTC(),
    reminders: store.reminders.all(), todos: store.todos.all(),
    notes: store.notes.all(), events: store.events.all(),
    automations: store.automations.all(), settings: loadSettings(),
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
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
