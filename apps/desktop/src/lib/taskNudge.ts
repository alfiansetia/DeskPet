/** Nudge tugas terbuka (PRD §5.11 automations): pengingat ringan yang TIDAK
 *  mengganggu — hanya bunyi bila ada yang actionable, maks 1x per slot/hari.
 *
 *  Ritme yang dipakai: 13:00 (cek siang) + 17:30 (beres-beres sore),
 *  melengkapi ringkasan pagi 09:00 yang sudah ada. Riset notifikasi
 *  konsisten: nagging sering (per jam) bikin habituasi + dimatikan user;
 *  2–3 ping/hari di jam transisi alami (pagi/siang/sore) yang paling
 *  efektif tanpa burnout.
 */
import type { Todo } from "./store";

export interface NudgeSlot { h: number; m: number; label: string }

/** Slot harian (jam lokal). Ubah di sini bila ritme tim berbeda. */
export const TASK_NUDGE_SLOTS: NudgeSlot[] = [
  { h: 13, m: 0, label: "13:00" },
  { h: 17, m: 30, label: "17:30" },
];

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Tugas yang layak diingatkan: belum selesai + (tanpa deadline / deadline
 * sudah lewat / jatuh tempo hari ini). Tugas future tidak ikut — belum
 * waktunya dicemaskan.
 */
export function tasksNeedingAttention(todos: Todo[], now: Date): Todo[] {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return todos.filter((t) => {
    if (!t || t.status === "completed") return false;
    if (!t.dueAt) return true;
    const d = new Date(t.dueAt);
    if (Number.isNaN(d.getTime())) return true;
    return d.getTime() <= endOfToday.getTime();
  });
}

/** Jumlah yang sudah lewat jatuh tempo (subset yang paling mendesak). */
export function countOverdue(open: Todo[], now: Date): number {
  return open.filter((t) => {
    if (!t.dueAt) return false;
    const d = new Date(t.dueAt);
    return !Number.isNaN(d.getTime()) && d.getTime() < now.getTime();
  }).length;
}

/** Slot yang sedang berjalan menit ini (tick 5 dtk), atau null. */
export function nudgeSlotNow(now: Date): NudgeSlot | null {
  for (const s of TASK_NUDGE_SLOTS) {
    if (now.getHours() === s.h && now.getMinutes() === s.m) return s;
  }
  return null;
}

/** Kunci anti-duplikat per slot per hari: "2026-10-15@13:00". */
export function nudgeSlotKey(now: Date, slot: NudgeSlot): string {
  return `${ymdLocal(now)}@${slot.label}`;
}

/**
 * Putuskan bunyi/tidak. Bunyi hanya bila: slot berjalan + belum bunyi slot
 * ini hari ini + ada >=1 tugas yang butuh perhatian.
 */
export function shouldFireTaskNudge(
  now: Date, todos: Todo[], lastRunAt?: string | null,
): { slot: NudgeSlot; key: string; open: Todo[] } | null {
  const slot = nudgeSlotNow(now);
  if (!slot) return null;
  const key = nudgeSlotKey(now, slot);
  if (lastRunAt === key) return null;
  const open = tasksNeedingAttention(todos, now);
  if (open.length === 0) return null;
  return { slot, key, open };
}
