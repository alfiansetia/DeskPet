/** Kalender bulanan lokal (murni, gampang dites).
 *
 * Dipakai tab Kalender: grid sebulan (Senin dulu, gaya Indonesia) + tanda
 * di tanggal yang punya pengingat/acara. Semua tanggal = lokal (bukan UTC)
 * agar selaras dengan yang user lihat di panel Pengingat.
 */

/** "YYYY-MM-DD" lokal dari Date (bukan UTC — anti-geser hari). */
export function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" lokal dari ISO string. Null bila tanggal invalid. */
export function ymdOfIso(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return ymdLocal(d);
}

/** Nama bulan Indonesia untuk header (index 0 = Januari). */
const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function monthLabel(year: number, monthIdx: number): string {
  return `${BULAN_ID[monthIdx] ?? "?"} ${year}`;
}

export const WEEKDAYS_ID = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/**
 * Grid 6x7 (42 sel) untuk sebulan, minggu dimulai Senin.
 * Selalu 42 sel agar tinggi grid stabil saat pindah bulan.
 */
export function buildMonthGrid(year: number, monthIdx: number): Date[] {
  const first = new Date(year, monthIdx, 1);
  // getDay(): Min=0..Sab=6 → geser agar Sen=0..Min=6.
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, monthIdx, 1 - lead);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return cells;
}

/** Kelompokkan item bertanggal (ISO) per hari lokal "YYYY-MM-DD". */
export function groupByDay<T>(items: T[], dateOf: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const iso = dateOf(item);
    if (!iso) continue;
    const day = ymdOfIso(iso);
    if (!day) continue;
    const list = map.get(day);
    if (list) list.push(item);
    else map.set(day, [item]);
  }
  return map;
}
