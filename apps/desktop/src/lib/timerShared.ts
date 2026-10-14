/** Timer terpusat multi-window.
 *
 * Masalah yang diperbaiki: timer lama hidup di memori per-window (`useRef`
 * di tiap App), sehingga countdown/badge/alert selesai hanya ada di window
 * tempat timer dimulai — dari window lain timer terlihat "ga work".
 *
 * Arsitektur baru (konsisten dengan scheduler terpusat PRD §5.2):
 * - State timer disimpan di localStorage (shared antar window).
 * - SEMUA window menampilkan countdown (badge + tab Timer).
 * - HANYA primary (`main`) yang mengeksekusi selesai + merutekan alert ke
 *   presenter sesuai role (`timer` > `all`), via `routeOrPresent` di App.
 */
import { loadJSON, saveJSON } from "./storage";

export interface SharedTimer {
  /** Epoch ms saat timer selesai. */
  endAt: number;
  label: string;
  durationSecs: number;
  /** Companion id pemilik window tempat timer dimulai (info saja). */
  startedBy: string;
  /** Epoch ms saat timer dimulai. */
  startedAt: number;
}

export const TIMER_KEY = "deskpet:timer";

/** Timer basi (>24 jam lewat) dianggap hangus agar tidak meledak saat boot. */
const STALE_MS = 24 * 3600_000;

export function loadSharedTimer(now = Date.now()): SharedTimer | null {
  const raw = loadJSON<Partial<SharedTimer> | null>(TIMER_KEY, null);
  if (!raw || typeof raw !== "object") return null;
  const endAt = typeof raw.endAt === "number" && Number.isFinite(raw.endAt) ? raw.endAt : NaN;
  if (!Number.isFinite(endAt)) return null;
  if (now - endAt > STALE_MS) return null;
  const durationSecs = typeof raw.durationSecs === "number" && Number.isFinite(raw.durationSecs) && raw.durationSecs > 0
    ? Math.floor(raw.durationSecs)
    : Math.max(1, Math.round((endAt - now) / 1000));
  return {
    endAt,
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim().slice(0, 24) : "Fokus",
    durationSecs,
    startedBy: typeof raw.startedBy === "string" && raw.startedBy ? raw.startedBy : "main",
    startedAt: typeof raw.startedAt === "number" && Number.isFinite(raw.startedAt) ? raw.startedAt : now,
  };
}

export function saveSharedTimer(t: SharedTimer): void {
  saveJSON(TIMER_KEY, t);
}

export function clearSharedTimer(): void {
  try {
    localStorage.removeItem(TIMER_KEY);
  } catch { /* noop */ }
}

/** Sisa detik (dibulatkan, min 0). Null bila tidak ada timer. */
export function sharedTimerLeft(t: SharedTimer | null, now = Date.now()): number | null {
  if (!t) return null;
  return Math.max(0, Math.round((t.endAt - now) / 1000));
}
