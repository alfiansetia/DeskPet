/** DeskPet time helpers (PRD §5.2). UTC storage, local interpretation, ID+EN parsing. */

export function toUTCISOString(d: Date): string {
  return d.toISOString();
}

export function nowUTC(): string {
  return new Date().toISOString();
}

/** Quiet hours check: [startHour, endHour) local time. Default 22:00–07:00. */
export function isQuietHours(now = new Date(), start = 22, end = 7): boolean {
  const h = now.getHours();
  if (start <= end) return h >= start && h < end;
  return h >= start || h < end;
}

export type Recurrence = "none" | "daily" | "weekdays" | "weekly";

export function nextOccurrence(from: Date, rule: Recurrence): Date | null {
  const d = new Date(from);
  if (rule === "none") return null;
  if (rule === "daily") {
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (rule === "weekly") {
    d.setDate(d.getDate() + 7);
    return d;
  }
  // weekdays: advance to next Mon–Fri
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

const DAY_ID: Record<string, number> = {
  minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6,
  ming: 0, sen: 1, sel: 2, rab: 3, kam: 4, jum: 5, sab: 6,
};
const DAY_EN: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/**
 * Deterministic local NL date parser (ID + EN). Returns a future Date or null.
 * Handles: "jam 4 sore", "16:30", "4pm", "besok jam 9 pagi", "dalam 25 menit",
 * "25 menit", "hari ini jam 8 malam", "senin jam 9", "monday 9am".
 */
export function parseNaturalDateTime(input: string, base = new Date()): Date | null {
  const s = input.toLowerCase().trim();
  if (!s) return null;

  // "dalam N menit/detik/jam" or "N menit lagi"
  let m = s.match(/(\d+)\s*(menit|menitnya|minute|min|detik|second|sec|jam|hour|hrs?)\b.*?(\blagi\b|\bkedepan\b|\bdari sekarang\b)?/);
  // Only treat as relative if explicit "dalam" or "lagi" present, or timer-like "25 menit"
  const relative = s.match(/(?:dalam|in)\s+(\d+)\s*(menit|minutes?|mins?|detik|seconds?|secs?|jam|hours?|hrs?)/)
    ?? s.match(/(\d+)\s*(menit|minutes?|mins?|detik|seconds?|secs?)\s+(lagi|from now)/)
    ?? s.match(/^(\d+)\s*(menit|minutes?|mins?)\s*$/);
  if (relative) {
    const n = parseInt(relative[1], 10);
    const unit = relative[2];
    const d = new Date(base);
    if (unit.startsWith("jam") || unit.startsWith("hour") || unit.startsWith("hr")) d.setHours(d.getHours() + n);
    else if (unit.startsWith("detik") || unit.startsWith("sec")) d.setSeconds(d.getSeconds() + n);
    else d.setMinutes(d.getMinutes() + n);
    if (Number.isNaN(n) || n <= 0 || n > 24 * 60) return null;
    return d;
  }
  void m;

  // Day offset
  let dayOffset = 0;
  if (/\bbesok\b|\btomorrow\b/.test(s)) dayOffset = 1;
  else if (/\blusa\b|\bday after tomorrow\b/.test(s)) dayOffset = 2;
  else if (/\bhari ini\b|\btoday\b/.test(s)) dayOffset = 0;

  // Named weekday (next occurrence)
  let weekdayTarget: number | null = null;
  for (const [k, v] of Object.entries({ ...DAY_ID, ...DAY_EN })) {
    if (new RegExp(`\\b${k}\\b`).test(s)) { weekdayTarget = v; break; }
  }

  // Time: "jam 4 sore", "pukul 16:30", "4pm", "16.30", "9 pagi"
  let hour: number | null = null;
  let minute = 0;
  const hm = s.match(/(?:jam|pukul|at|@)?\s*(\d{1,2})(?:[:.](\d{2}))?\s*(pagi|siang|sore|malam|petang|am|pm|a\.m|p\.m)?/);
  if (hm) {
    // Require either explicit time marker or colon format to avoid matching random numbers
    const hasMarker = /jam|pukul|pagi|siang|sore|malam|petang|\bam\b|\bpm\b|:|\./.test(s);
    if (hasMarker) {
      let h = parseInt(hm[1], 10);
      minute = hm[2] ? parseInt(hm[2], 10) : 0;
      const mer = hm[3] ?? "";
      if (minute < 0 || minute > 59) return null;
      if (mer === "pm" || mer === "p.m" || mer === "sore" || mer === "petang") {
        if (h < 12) h += 12;
      } else if (mer === "malam") {
        if (h < 12) h += 12;
      } else if (mer === "siang") {
        if (h < 12 && h >= 10) { /* 10-11 siang stays */ } else if (h < 12) h += 12;
      } else if (mer === "am" || mer === "a.m" || mer === "pagi") {
        if (h === 12) h = 0;
      } else if (mer === "" && h <= 12) {
        // Bare hour without marker: only accept if "jam"/"pukul" present
        if (!/jam|pukul/.test(s)) { /* fall through: treat as no time */ }
        else if (h < 12 && h <= 7) {
          // ambiguous small hour like "jam 4" with no marker: assume future (see below)
        }
      }
      if (h < 0 || h > 23) return null;
      hour = h;
    }
  }

  if (hour === null && weekdayTarget === null && dayOffset === 0) return null;
  if (hour === null) {
    // weekday without time -> 9:00
    hour = 9; minute = 0;
  }

  const d = new Date(base);
  d.setSeconds(0, 0);
  if (weekdayTarget !== null) {
    let delta = (weekdayTarget - d.getDay() + 7) % 7;
    const candidate = new Date(d);
    candidate.setHours(hour, minute, 0, 0);
    if (delta === 0 && candidate <= d) delta = 7;
    d.setDate(d.getDate() + delta);
    d.setHours(hour, minute, 0, 0);
    return d;
  }
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  // If time already passed today (and no explicit besok), roll to tomorrow
  if (dayOffset === 0 && weekdayTarget === null && d <= base) {
    // Only roll if the input looks like a time intent (has time marker)
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** "25 menit", "1 jam 30 menit", "90 detik" -> seconds, or null. */
export function parseDurationSeconds(input: string): number | null {
  const s = input.toLowerCase();
  let total = 0;
  const re = /(\d+)\s*(jam|hours?|hrs?|menit|minutes?|mins?|detik|seconds?|secs?)/g;
  let mm: RegExpExecArray | null;
  let found = false;
  while ((mm = re.exec(s))) {
    found = true;
    const n = parseInt(mm[1], 10);
    const u = mm[2];
    if (u.startsWith("jam") || u.startsWith("hour") || u.startsWith("hr")) total += n * 3600;
    else if (u.startsWith("detik") || u.startsWith("sec")) total += n;
    else total += n * 60;
  }
  if (!found) return null;
  if (total <= 0 || total > 12 * 3600) return null;
  return total;
}

export function formatDue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
