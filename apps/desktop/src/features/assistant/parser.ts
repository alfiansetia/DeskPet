/** Deterministic local NL parser (PRD §5.6). ID + EN. No network, no AI needed.
 *  Query/complete/delete/snooze/search butuh data: via AssistContext eksplisit
 *  (testable) atau live store bila omit. ntfy.send satu-satunya yang network
 *  (POST ke server ntfy, selalu perlu konfirmasi).
 */
import { parseDurationSeconds, parseNaturalDateTime, toUTCISOString } from "../../lib/time";
import { store, type Note, type PermissionClass, type Reminder, type Todo } from "../../lib/store";
import { loadApiWatch } from "../apiwatch/apiwatch";

export type ActionRequest =
  | { type: "reminder.create"; title: string; dueAt: string; timezone: string }
  | { type: "reminder.snooze"; reminderId: string; title: string; snoozeUntil: string }
  | { type: "todo.create"; title: string; dueAt?: string }
  | { type: "todo.complete"; todoId: string; title: string }
  | { type: "todo.delete"; todoId: string; title: string }
  | { type: "note.create"; title: string; content: string }
  | { type: "note.delete"; noteId: string; title: string }
  | { type: "notes.search"; keyword: string }
  | { type: "timer.start"; durationSeconds: number; label?: string }
  | { type: "tasks.query"; scope: "today" | "all" | "overdue"; keyword?: string }
  | { type: "calendar.create"; title: string; startAt: string; endAt: string }
  | { type: "ntfy.send"; topic: string; title: string; message: string }
  | { type: "unknown"; raw: string };

export interface ParsedAction {
  action: ActionRequest;
  preview: string;
  permission: PermissionClass;
  needsConfirm: boolean;
  processedLocally: true;
}

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";

export interface AssistContext {
  reminders: Reminder[];
  todos: Todo[];
  notes: Note[];
}

function liveContext(): AssistContext {
  try {
    return { reminders: store.reminders.all(), todos: store.todos.all(), notes: store.notes.all() };
  } catch {
    return { reminders: [], todos: [], notes: [] };
  }
}

/** Cocok judul: semua kata kunci (>2 huruf) harus mengandung di judul. */
function matchByTitle<T>(items: T[], getTitle: (t: T) => string, keyword: string): T[] {
  const kw = keyword.toLowerCase().trim();
  if (!kw) return [];
  const words = kw.split(/\s+/).filter((w) => w.length > 2);
  const keys = words.length > 0 ? words : [kw];
  return items.filter((it) => {
    const t = getTitle(it).toLowerCase();
    return keys.every((k) => t.includes(k));
  });
}

function unknownWith(raw: string, preview: string, permission: PermissionClass = "read_local"): ParsedAction {
  return { action: { type: "unknown", raw }, preview, permission, needsConfirm: false, processedLocally: true };
}

function cleanTitle(s: string, stopwords: RegExp[]): string {
  let t = s;
  for (const r of stopwords) t = t.replace(r, " ");
  return t.replace(/\s{2,}/g, " ").trim().replace(/^[\s,.:;—-]+|[\s,.:;—-]+$/g, "");
}

export function parseCommand(input: string, base = new Date(), ctx?: AssistContext): ParsedAction {
  const raw = input.trim();
  const s = raw.toLowerCase();
  const data = ctx ?? liveContext();
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

  // ntfy: "kirim notif ke topik X: pesan" / "push ..." (network, selalu konfirmasi)
  if (/\b(ntfy|notif\w*|push)\b/.test(s) || (/\bkirim\b/.test(s) && /\b(notif|push)\b/.test(s))) {
    const topicM = raw.match(/ke topik\s+([A-Za-z0-9_-]{1,64})/i);
    const topic = topicM ? topicM[1] : loadApiWatch().topic;
    const message = cleanTitle(raw, [/\b(kirim|kirimkan|send|push)\b/gi, /\b(notif\w*|ntfy|notifikasi|pemberitahuan)\b/gi, /ke topik\s+[A-Za-z0-9_-]{1,64}/gi, /^[:\s,.-]+/]);
    if (!message) {
      return unknownWith(raw, "Mau kirim pesan apa? Coba: 'kirim notif ke topik X: halo'.");
    }
    if (!topic) {
      return unknownWith(raw, "Topic belum diisi (atur di tab ntfy) atau sebutkan: 'kirim notif ke topik NAMATOPIK: pesan'.");
    }
    const title = message.length > 80 ? `${message.slice(0, 80)}…` : message;
    return {
      action: { type: "ntfy.send", topic, title, message },
      preview: `Kirim notif ke topik ${topic}: "${title}" (perlu konfirmasi).`,
      permission: "external_write", needsConfirm: true, processedLocally: true,
    };
  }

  // Todo complete: "selesaikan tugas beli susu" / "tandai selesai ..."
  // (Bukan "ingatkan ... setelah selesai ...": kata kerja ingat = pengingat.)
  if (/\b(selesai\w*|tandai selesai|done|completed?|centang)\b/.test(s) && !/\b(ingat\w*|remind|alarm)\b/.test(s)) {
    const keyword = cleanTitle(raw, [/\b(selesai\w*|tandai|telah|sudah|done|complete\w*|centang)\b/gi, /\b(tugas|todo|to-?do|task|yang)\b/gi, /\b(saya|aku|gue|tolong)\b/gi]);
    const open = data.todos.filter((t) => t.status !== "completed");
    const hits = matchByTitle(open, (t) => t.title, keyword);
    if (!keyword) return unknownWith(raw, "Tugas mana yang selesai? Coba: 'selesaikan tugas beli susu'.");
    if (hits.length === 0) return unknownWith(raw, `Tidak ada tugas terbuka yang cocok dengan "${keyword}".`);
    if (hits.length > 1) {
      const names = hits.slice(0, 3).map((t) => `"${t.title}"`).join(", ");
      return unknownWith(raw, `Ada ${hits.length} yang cocok (${names}). Sebutkan lebih spesifik.`);
    }
    const t = hits[0];
    return {
      action: { type: "todo.complete", todoId: t.id, title: t.title },
      preview: `Tandai selesai: "${t.title}" (perlu konfirmasi).`,
      permission: "write_local", needsConfirm: true, processedLocally: true,
    };
  }

  // Delete: "hapus tugas X" / "hapus catatan Y" (permanen untuk tugas, arsip untuk catatan)
  if (/\b(hapus\w*|delete|buang)\b/.test(s)) {
    const isNote = /\b(catatan|note|notulen)\b/.test(s);
    if (isNote) {
      const keyword = cleanTitle(raw, [/\b(hapus\w*|delete|buang)\b/gi, /\b(catatan|note|notulen|yang)\b/gi]);
      const alive = data.notes.filter((n) => !n.deletedAt);
      const hits = matchByTitle(alive, (n) => `${n.title} ${n.content}`.slice(0, 500), keyword);
      if (!keyword) return unknownWith(raw, "Catatan mana yang dihapus? Coba: 'hapus catatan belanja'.");
      if (hits.length === 0) return unknownWith(raw, `Tidak ada catatan yang cocok dengan "${keyword}".`);
      if (hits.length > 1) {
        const names = hits.slice(0, 3).map((n) => `"${n.title}"`).join(", ");
        return unknownWith(raw, `Ada ${hits.length} yang cocok (${names}). Sebutkan lebih spesifik.`);
      }
      return {
        action: { type: "note.delete", noteId: hits[0].id, title: hits[0].title },
        preview: `Arsipkan catatan "${hits[0].title}" (perlu konfirmasi).`,
        permission: "write_local", needsConfirm: true, processedLocally: true,
      };
    }
    const keyword = cleanTitle(raw, [/\b(hapus\w*|delete|buang)\b/gi, /\b(tugas|todo|to-?do|task|yang)\b/gi, /\b(saya|aku|gue|tolong)\b/gi]);
    const hits = matchByTitle(data.todos, (t) => t.title, keyword);
    if (!keyword) return unknownWith(raw, "Tugas mana yang dihapus? Coba: 'hapus tugas beli susu'.");
    if (hits.length === 0) return unknownWith(raw, `Tidak ada tugas yang cocok dengan "${keyword}".`);
    if (hits.length > 1) {
      const names = hits.slice(0, 3).map((t) => `"${t.title}"`).join(", ");
      return unknownWith(raw, `Ada ${hits.length} yang cocok (${names}). Sebutkan lebih spesifik.`);
    }
    return {
      action: { type: "todo.delete", todoId: hits[0].id, title: hits[0].title },
      preview: `Hapus permanen tugas "${hits[0].title}" (perlu konfirmasi).`,
      permission: "write_local", needsConfirm: true, processedLocally: true,
    };
  }

  // Snooze: "tunda pengingat rapat 10 menit" / "snooze alarm ..."
  if (/\b(tunda|snooze|mundur\w*)\b/.test(s)) {
    const secs = parseDurationSeconds(s) ?? 600;
    const keyword = cleanTitle(raw, [/\b(tunda|snooze|mundur\w*)\b/gi, /\b(pengingat|reminder|alarm|yang)\b/gi, /\b(saya|aku|gue|tolong)\b/gi, /\b(dalam|selama|untuk|selama)\b\s*\d+\s*\w+/gi, /\b\d+\s*(menit|minutes?|mins?|jam|hours?|detik|seconds?)\b/gi]);
    const active = data.reminders.filter((r) => r.status === "active");
    const hits = matchByTitle(active, (r) => `${r.title} ${r.body ?? ""}`.slice(0, 500), keyword);
    if (!keyword) return unknownWith(raw, "Pengingat mana yang ditunda? Coba: 'tunda pengingat rapat 10 menit'.");
    if (hits.length === 0) return unknownWith(raw, `Tidak ada pengingat aktif yang cocok dengan "${keyword}".`);
    if (hits.length > 1) {
      const names = hits.slice(0, 3).map((r) => `"${r.title}"`).join(", ");
      return unknownWith(raw, `Ada ${hits.length} yang cocok (${names}). Sebutkan lebih spesifik.`);
    }
    const until = new Date(base.getTime() + secs * 1000);
    return {
      action: { type: "reminder.snooze", reminderId: hits[0].id, title: hits[0].title, snoozeUntil: until.toISOString() },
      preview: `Tunda "${hits[0].title}" sampai ${until.toLocaleString("id-ID")} (perlu konfirmasi).`,
      permission: "scheduled", needsConfirm: true, processedLocally: true,
    };
  }

  // Search: "cari catatan X" -> notes.search; "cari tugas Y" -> tasks.query+keyword
  if (/\b(cari\w*|search|temukan|find)\b/.test(s)) {
    const keyword = cleanTitle(raw, [/\b(cari\w*|search|temukan|find|tolong)\b/gi, /\b(catatan|note|notulen|tugas|todo|to-?do|task|yang|tentang|dengan kata)\b/gi]);
    if (!keyword) return unknownWith(raw, "Mau cari apa? Coba: 'cari catatan belanja'.");
    if (/\b(tugas|todo|to-?do|task)\b/.test(s)) {
      return {
        action: { type: "tasks.query", scope: "all", keyword },
        preview: `Cari tugas mengandung "${keyword}".`,
        permission: "read_local", needsConfirm: false, processedLocally: true,
      };
    }
    return {
      action: { type: "notes.search", keyword },
      preview: `Cari catatan mengandung "${keyword}".`,
      permission: "read_local", needsConfirm: false, processedLocally: true,
    };
  }

  // Query: "tugas apa hari ini", "tugas menumpuk", "semua tugas"
  if (/\b(tugas|task|todo|jadwal hari ini|apa yang jatuh tempo)\b/.test(s) && /\b(hari ini|today|jatuh tempo|due)\b/.test(s)) {
    return { action: { type: "tasks.query", scope: "today" }, preview: "Tampilkan tugas jatuh tempo hari ini.", permission: "read_local", needsConfirm: false, processedLocally: true };
  }
  if (/\b(tugas|todo|task)\b/.test(s) && /\b(menumpuk|terlambat|telat|overdue|lewat)\b/.test(s)) {
    return { action: { type: "tasks.query", scope: "overdue" }, preview: "Tampilkan tugas yang lewat jatuh tempo.", permission: "read_local", needsConfirm: false, processedLocally: true };
  }
  if (/\b(semua tugas|daftar tugas|list tugas|lihat tugas|tampilkan tugas)\b/.test(s)) {
    return { action: { type: "tasks.query", scope: "all" }, preview: "Tampilkan semua tugas terbuka.", permission: "read_local", needsConfirm: false, processedLocally: true };
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

  return { action: { type: "unknown", raw }, preview: "Belum paham. Coba: 'ingatkan deploy jam 4 sore' · 'tambah beli susu ke tugas' · 'selesaikan tugas beli susu' · 'tunda pengingat rapat 10 menit' · 'cari catatan belanja' · 'tugas menumpuk' · 'timer 25 menit'.", permission: "read_local", needsConfirm: false, processedLocally: true };
}

/** Rust-mirror validation (frontend pre-check; Rust `action_validate` is authoritative). */
export function validateAction(a: ActionRequest): { ok: boolean; error?: string } {
  switch (a.type) {
    case "reminder.create":
      if (!a.title.trim()) return { ok: false, error: "Judul pengingat kosong." };
      if (a.title.length > 200) return { ok: false, error: "Judul terlalu panjang (maks 200)." };
      if (Number.isNaN(Date.parse(a.dueAt))) return { ok: false, error: "Waktu tidak valid." };
      return { ok: true };
    case "reminder.snooze":
      if (!a.reminderId) return { ok: false, error: "Pengingat tidak dikenal." };
      if (Number.isNaN(Date.parse(a.snoozeUntil))) return { ok: false, error: "Waktu tunda tidak valid." };
      return { ok: true };
    case "todo.create":
      if (!a.title.trim()) return { ok: false, error: "Judul tugas kosong." };
      if (a.title.length > 200) return { ok: false, error: "Judul terlalu panjang." };
      if (a.dueAt && Number.isNaN(Date.parse(a.dueAt))) return { ok: false, error: "Due date tidak valid." };
      return { ok: true };
    case "todo.complete":
    case "todo.delete":
      if (!a.todoId) return { ok: false, error: "Tugas tidak dikenal." };
      return { ok: true };
    case "note.create":
      if (a.title.length > 200) return { ok: false, error: "Judul terlalu panjang." };
      if (a.content.length > 20000) return { ok: false, error: "Catatan terlalu panjang." };
      return { ok: true };
    case "note.delete":
      if (!a.noteId) return { ok: false, error: "Catatan tidak dikenal." };
      return { ok: true };
    case "notes.search":
      if (!a.keyword.trim()) return { ok: false, error: "Kata kunci kosong." };
      return { ok: true };
    case "tasks.query":
      if (a.scope !== "today" && a.scope !== "all" && a.scope !== "overdue") return { ok: false, error: "Scope tidak dikenal." };
      return { ok: true };
    case "ntfy.send":
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(a.topic)) return { ok: false, error: "Topic tidak valid." };
      if (!a.message.trim()) return { ok: false, error: "Pesan kosong." };
      if (a.message.length > 4000) return { ok: false, error: "Pesan terlalu panjang." };
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

/** Murni: tampilkan hasil tasks.query sebagai teks (dipakai execute + test). */
export function runTasksQuery(
  todos: Todo[],
  scope: "today" | "all" | "overdue",
  keyword?: string,
): string {
  const now = new Date();
  const day = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  let list = todos.filter((t) => t.status !== "completed");
  if (scope === "today") {
    const today = day(now);
    list = list.filter((t) => t.dueAt && day(new Date(t.dueAt)) === today);
  } else if (scope === "overdue") {
    list = list.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < now.getTime());
  }
  const kw = (keyword ?? "").trim().toLowerCase();
  if (kw) list = list.filter((t) => t.title.toLowerCase().includes(kw));
  if (list.length === 0) {
    return scope === "overdue"
      ? "Nihil — tidak ada tugas terlambat."
      : scope === "today"
        ? "Tidak ada tugas jatuh tempo hari ini."
        : "Tidak ada tugas terbuka.";
  }
  const shown = list.slice(0, 5).map((t, i) => `${i + 1}. ${t.title}`).join(" · ");
  const more = list.length > 5 ? ` (+${list.length - 5} lainnya, lihat tab Tugas)` : "";
  const label = scope === "today" ? "jatuh tempo hari ini" : scope === "overdue" ? "terlambat" : "terbuka";
  return `${list.length} tugas ${label}: ${shown}${more}`;
}

/** Murni: tampilkan hasil notes.search sebagai teks (dipakai execute + test). */
export function runNotesSearch(notes: Note[], keyword: string): string {
  const kw = keyword.toLowerCase().trim();
  const words = kw.split(/\s+/).filter((w) => w.length > 2);
  const keys = words.length > 0 ? words : [kw];
  const hits = notes.filter(
    (n) => !n.deletedAt && keys.every((k) => `${n.title} ${n.content}`.toLowerCase().includes(k)),
  );
  if (hits.length === 0) return `Tidak ada catatan mengandung "${keyword.trim()}".`;
  const shown = hits
    .slice(0, 5)
    .map((n) => `"${n.title || "tanpa judul"}"`)
    .join(" · ");
  const more = hits.length > 5 ? ` (+${hits.length - 5} lainnya)` : "";
  return `${hits.length} catatan cocok: ${shown}${more}`;
}
