/** Deterministic local NL parser (PRD §5.6). ID + EN. No network, no AI needed. */
import { parseDurationSeconds, parseNaturalDateTime, toUTCISOString } from "../../lib/time";
import type { PermissionClass } from "../../lib/store";

export type ActionRequest =
  | { type: "reminder.create"; title: string; dueAt: string; timezone: string }
  | { type: "todo.create"; title: string; dueAt?: string }
  | { type: "note.create"; title: string; content: string }
  | { type: "timer.start"; durationSeconds: number; label?: string }
  | { type: "tasks.query"; scope: "today" | "all" | "overdue" }
  | { type: "calendar.create"; title: string; startAt: string; endAt: string }
  | { type: "unknown"; raw: string };

export interface ParsedAction {
  action: ActionRequest;
  preview: string;
  permission: PermissionClass;
  needsConfirm: boolean;
  processedLocally: true;
}

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";

function cleanTitle(s: string, stopwords: RegExp[]): string {
  let t = s;
  for (const r of stopwords) t = t.replace(r, " ");
  return t.replace(/\s{2,}/g, " ").trim().replace(/^[\s,.:;—-]+|[\s,.:;—-]+$/g, "");
}

export function parseCommand(input: string, base = new Date()): ParsedAction {
  const raw = input.trim();
  const s = raw.toLowerCase();
  if (!s) return { action: { type: "unknown", raw }, preview: "Ketik perintah, mis. 'ingatkan saya bayar listrik besok jam 9 pagi'.", permission: "read_local", needsConfirm: false, processedLocally: true };

  // Timer / focus: "timer 25 menit", "fokus 25 menit", "start 25-minute focus timer"
  if (/\b(timer|fokus|focus|pomodoro)\b/.test(s)) {
    const secs = parseDurationSeconds(s);
    if (secs !== null) {
      return {
        action: { type: "timer.start", durationSeconds: secs, label: "Fokus" },
        preview: `Mulai timer ${Math.round(secs / 60)} menit.`,
        permission: "scheduled", needsConfirm: false, processedLocally: true,
      };
    }
  }
  // Bare duration "25 menit" -> timer
  if (/^\d+\s*(menit|minutes?|mins?|jam|hours?)\s*$/.test(s)) {
    const secs = parseDurationSeconds(s);
    if (secs !== null) {
      return {
        action: { type: "timer.start", durationSeconds: secs },
        preview: `Mulai timer ${Math.round(secs / 60)} menit.`,
        permission: "scheduled", needsConfirm: false, processedLocally: true,
      };
    }
  }

  // Query: "tugas apa hari ini", "what tasks are due today"
  if (/\b(tugas|task|todo|jadwal hari ini|apa yang jatuh tempo)\b/.test(s) && /\b(hari ini|today|jatuh tempo|due)\b/.test(s)) {
    return { action: { type: "tasks.query", scope: "today" }, preview: "Tampilkan tugas jatuh tempo hari ini.", permission: "read_local", needsConfirm: false, processedLocally: true };
  }

  // Reminder: "ingatkan/ingetin/remind ..." (match word prefix: ingatkan, ingetin, pengingat)
  if (/\b(ingat\w*|inget\w*|remind|alarm|pengingat)\b/.test(s)) {
    const due = parseNaturalDateTime(raw, base);
    const title = cleanTitle(raw, [/\b(tolong|tolong )?(ingat|inget|ingatkan|ingetin|remind me|remind|alarm)\b/gi, /\b(saya|aku|gue|me)\b/gi, /\b(untuk|to|tentang|about|bahwa|kalau)\b/gi, /\b(besok|tomorrow|lusa|hari ini|today)\b/gi, /\b(jam|pukul|at|@)\s*\d{1,2}(?:[:.]\d{2})?\s*(pagi|siang|sore|malam|petang|am|pm)?/gi, /\b(dalam|in)\s+\d+\s*\w+/gi]);
    if (!due) {
      return { action: { type: "unknown", raw }, preview: "Kapan pengingatnya? Coba: 'ingatkan saya rapat besok jam 9 pagi'.", permission: "scheduled", needsConfirm: false, processedLocally: true };
    }
    return {
      action: { type: "reminder.create", title: title || "Pengingat", dueAt: toUTCISOString(due), timezone: TZ },
      preview: `Buat pengingat "${title || "Pengingat"}" pada ${due.toLocaleString("id-ID")}.`,
      permission: "scheduled", needsConfirm: false, processedLocally: true,
    };
  }

  // Todo: "tambah ... ke todo / tugas / to-do", "add ... to my to-do"
  if (/\b(todo|to-?do|tugas|task|catat|tambah)\b/.test(s)) {
    const due = parseNaturalDateTime(raw, base);
    const title = cleanTitle(raw, [/\b(tambah|tambahkan|add|buat|create|catat)\b/gi, /\b(ke|to|into|ke dalam)\b\s*(todo|to-?do|tugas|task|daftar|list)?/gi, /\b(saya|aku|gue|my)\b/gi, /\b(besok|tomorrow|lusa|hari ini|today)\b/gi, /\b(jam|pukul|at)\s*\d{1,2}(?:[:.]\d{2})?\s*(pagi|siang|sore|malam|am|pm)?/gi]);
    return {
      action: { type: "todo.create", title: title || raw.slice(0, 60), dueAt: due ? toUTCISOString(due) : undefined },
      preview: due ? `Tambah tugas "${title}" (jatuh tempo ${due.toLocaleString("id-ID")}).` : `Tambah tugas "${title}".`,
      permission: "write_local", needsConfirm: false, processedLocally: true,
    };
  }

  // Note: "catat sebagai catatan ..." / "note ..."
  if (/\b(catatan|note|notulen)\b/.test(s)) {
    const title = cleanTitle(raw, [/\b(buat|buatkan|tambah|add|create)\b/gi, /\b(catatan|note)\b/gi]);
    return {
      action: { type: "note.create", title: title.slice(0, 60) || "Catatan", content: raw },
      preview: `Buat catatan "${title.slice(0, 60) || "Catatan"}".`,
      permission: "write_local", needsConfirm: false, processedLocally: true,
    };
  }

  // Calendar local: "jadwal rapat senin jam 10" / "schedule meeting ..."
  if (/\b(jadwal|jadwalkan|schedule|meeting|rapat|acara|event)\b/.test(s)) {
    const start = parseNaturalDateTime(raw, base);
    if (start) {
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const title = cleanTitle(raw, [/\b(jadwal|jadwalkan|schedule|buat|tambah)\b/gi, /\b(rapat|meeting|acara|event)\b/gi, /\b(senin|selasa|rabu|kamis|jumat|sabtu|minggu|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, /\b(besok|tomorrow|lusa|hari ini|today)\b/gi, /\b(jam|pukul|at)\s*\d{1,2}(?:[:.]\d{2})?\s*(pagi|siang|sore|malam|am|pm)?/gi]);
      return {
        action: { type: "calendar.create", title: title || "Acara", startAt: toUTCISOString(start), endAt: toUTCISOString(end) },
        preview: `Buat acara lokal "${title || "Acara"}" ${start.toLocaleString("id-ID")} (1 jam, perlu konfirmasi).`,
        permission: "write_local", needsConfirm: true, processedLocally: true,
      };
    }
  }

  // Draft email intent -> NOT executed locally; must preview + confirm (PRD §5.10).
  if (/\b(email|e-?mail|kirim|send|draft)\b/.test(s)) {
    return { action: { type: "unknown", raw }, preview: "Draf email butuh konfirmasi manual di panel Integrasi — DeskPet tidak mengirim otomatis.", permission: "external_write", needsConfirm: true, processedLocally: true };
  }

  return { action: { type: "unknown", raw }, preview: "Belum paham. Coba: 'ingatkan deploy jam 4 sore' / 'tambah beli susu ke tugas' / 'timer 25 menit'.", permission: "read_local", needsConfirm: false, processedLocally: true };
}

/** Rust-mirror validation (frontend pre-check; Rust `action_validate` is authoritative). */
export function validateAction(a: ActionRequest): { ok: boolean; error?: string } {
  switch (a.type) {
    case "reminder.create":
      if (!a.title.trim()) return { ok: false, error: "Judul pengingat kosong." };
      if (a.title.length > 200) return { ok: false, error: "Judul terlalu panjang (maks 200)." };
      if (Number.isNaN(Date.parse(a.dueAt))) return { ok: false, error: "Waktu tidak valid." };
      return { ok: true };
    case "todo.create":
      if (!a.title.trim()) return { ok: false, error: "Judul tugas kosong." };
      if (a.title.length > 200) return { ok: false, error: "Judul terlalu panjang." };
      if (a.dueAt && Number.isNaN(Date.parse(a.dueAt))) return { ok: false, error: "Due date tidak valid." };
      return { ok: true };
    case "note.create":
      if (a.title.length > 200) return { ok: false, error: "Judul terlalu panjang." };
      if (a.content.length > 20000) return { ok: false, error: "Catatan terlalu panjang." };
      return { ok: true };
    case "timer.start":
      if (!Number.isFinite(a.durationSeconds) || a.durationSeconds <= 0 || a.durationSeconds > 43200) return { ok: false, error: "Durasi timer tidak valid." };
      return { ok: true };
    case "calendar.create":
      if (!a.title.trim()) return { ok: false, error: "Judul acara kosong." };
      if (Number.isNaN(Date.parse(a.startAt)) || Number.isNaN(Date.parse(a.endAt))) return { ok: false, error: "Waktu acara tidak valid." };
      return { ok: true };
    default:
      return { ok: false, error: "Aksi tidak dikenal — ditolak (allowlist)." };
  }
}
