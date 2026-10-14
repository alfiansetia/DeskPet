/** Spesies karakter DeskPet. Satu folder aset per spesies:
 * `assets/characters/<species>/` (spritesheets + manifest + SVG master).
 * Warna diatur terpisah via palette (`palettes.ts`) yang berlaku lintas spesies.
 */

export type PetSpecies = "cat" | "snake" | "frog" | "owl" | "penguin";

export const PET_SPECIES: { id: PetSpecies; name: string; icon: string }[] = [
  { id: "cat", name: "Kucing", icon: "🐱" },
  { id: "snake", name: "Ular", icon: "🐍" },
  { id: "frog", name: "Kodok", icon: "🐸" },
  { id: "owl", name: "Burung Hantu", icon: "🦉" },
  { id: "penguin", name: "Penguin", icon: "🐧" },
];

export function isPetSpecies(v: unknown): v is PetSpecies {
  return v === "cat" || v === "snake" || v === "frog" || v === "owl" || v === "penguin";
}

/** ID karakter kanonis untuk satu spesies. */
export function characterIdFor(species: PetSpecies): string {
  return `deskpet.${species}`;
}
