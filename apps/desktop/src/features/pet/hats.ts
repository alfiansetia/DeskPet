/** Topi & aksesori overlay (emoji, tanpa pipeline art baru).
 * Jangkar per spesies dalam koordinat 128px PetCanvas (ikut ter-scale otomatis).
 */
import type { PetSpecies } from "./species";

export interface Hat { id: string; name: string; emoji: string; unlockPets: number }
export interface HatAnchor { dx: number; top: number; size: number }

export const HATS: Hat[] = [
  { id: "none", name: "Tanpa topi", emoji: "", unlockPets: 0 },
  { id: "cap", name: "Topi", emoji: "🧢", unlockPets: 0 },
  { id: "party", name: "Topi pesta", emoji: "🥳", unlockPets: 5 },
  { id: "crown", name: "Mahkota", emoji: "👑", unlockPets: 15 },
];

/** Posisi topi di atas kepala tiap spesies (128px space, dx dari tengah). */
export const HAT_ANCHORS: Record<PetSpecies, HatAnchor> = {
  cat: { dx: 0, top: -16, size: 30 },
  snake: { dx: 22, top: 6, size: 26 },
  frog: { dx: 0, top: 10, size: 28 },
};

export function hatById(id: string | undefined): Hat {
  return HATS.find((h) => h.id === id) ?? HATS[0];
}

/** Topi yang terbuka pada jumlah elusan tertentu. */
export function unlockedHats(pettingTotal: number): Hat[] {
  return HATS.filter((h) => pettingTotal >= h.unlockPets);
}

/** Topi yang BARU terbuka saat total berubah prev -> next (untuk toast). */
export function newlyUnlocked(prevTotal: number, nextTotal: number): Hat[] {
  if (nextTotal <= prevTotal) return [];
  return HATS.filter((h) => h.unlockPets > prevTotal && h.unlockPets <= nextTotal && h.id !== "none");
}

/** Id topi aktif yang valid (terbuka); null = tidak dirender. */
export function validActiveHat(activeHat: string | undefined, pettingTotal: number): string | null {
  const h = hatById(activeHat);
  if (h.id === "none") return null;
  return pettingTotal >= h.unlockPets ? h.id : null;
}
