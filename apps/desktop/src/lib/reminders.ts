/** Reminder presentation helpers (murni, gampang dites).
 * Dipakai tab Pengingat agar status/jadwal terbaca jelas user.
 */
import type { RecurrenceRule, Reminder } from "./store";

export function recurrenceLabel(r: RecurrenceRule): string {
  switch (r) {
    case "daily": return "Setiap hari";
    case "weekdays": return "Senin–Jumat";
    case "weekly": return "Setiap minggu";
    default: return "Sekali saja";
  }
}

/** Status yang tampil sebagai badge: aktif / ditunda / terlewat. */
export function reminderBadge(r: Reminder, now = Date.now()): { text: string; warn: boolean } {
  const due = r.snoozeUntil ?? r.dueAt;
  if (r.status === "snoozed") {
    return { text: `Ditunda s/d ${dueText(due)}`, warn: false };
  }
  if (new Date(due).getTime() <= now) {
    return { text: "Terlewat — segera berbunyi", warn: true };
  }
  return { text: "Aktif", warn: false };
}

function dueText(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** "3 jam 12 mnt lagi" / "terlewat 10 mnt" — relatif, ramah dibaca. */
export function relDue(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = t - now;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  let txt: string;
  if (mins < 1) txt = "sebentar";
  else if (mins < 60) txt = `${mins} mnt`;
  else if (mins < 60 * 24) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    txt = m ? `${h} jam ${m} mnt` : `${h} jam`;
  } else {
    const d = Math.floor(mins / (60 * 24));
    const h = Math.floor((mins % (60 * 24)) / 60);
    txt = h ? `${d} hari ${h} jam` : `${d} hari`;
  }
  return diff >= 0 ? `${txt} lagi` : `terlewat ${txt}`;
}

export interface ReminderGroups {
  upcoming: Reminder[];
  history: Reminder[];
}

/** Mendatang (aktif/ditunda, urut terdekat) vs riwayat (selesai/dibuang, terbaru dulu). */
export function splitReminders(items: Reminder[]): ReminderGroups {
  const dueOf = (r: Reminder) => new Date(r.snoozeUntil ?? r.dueAt).getTime();
  const upcoming = items
    .filter((r) => r.status === "active" || r.status === "snoozed")
    .sort((a, b) => dueOf(a) - dueOf(b));
  const history = items
    .filter((r) => r.status === "completed" || r.status === "dismissed")
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  return { upcoming, history };
}
