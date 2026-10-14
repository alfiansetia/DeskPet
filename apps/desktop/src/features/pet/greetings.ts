/** Sapaan acak saat pet diklik. Randomizer bisa di-inject agar testable. */
import type { PetSpecies } from "./species";

const BASE: Record<PetSpecies, string[]> = {
  cat: ["meow!", "hai!", "semangat ya!", "kamu hebat!", "sini sini~", "dielus dong~", "hari ini ceria!"],
  snake: ["ssst hai!", "melata dulu~", "kepala dingin~", "santai kayak ular~", "hai hai!"],
  frog: ["ribbit!", "lompat yuk!", "hai!", "kodok hadir!", "cebur!"],
};
const RAIN = ["hujan nih, di dalam aja ya~", "dingin! jangan kehujanan~", "enak denger hujan~"];
const HUNGRY = ["laper nih, minta makan dong", "perut bunyi...", "kapan makan?"];
const HAPPY = ["hehe~", "enak!", "lagi dong~", "senangnya!"];

export interface GreetContext {
  raining?: boolean;
  hungry?: boolean;
  happy?: boolean;
}

export function randomGreeting(
  species: PetSpecies,
  ctx: GreetContext = {},
  rnd: () => number = Math.random,
): string {
  if (ctx.happy) return HAPPY[Math.floor(rnd() * HAPPY.length)];
  if (ctx.hungry) return HUNGRY[Math.floor(rnd() * HUNGRY.length)];
  if (ctx.raining && rnd() < 0.35) return RAIN[Math.floor(rnd() * RAIN.length)];
  const pool = BASE[species] ?? BASE.cat;
  return pool[Math.floor(rnd() * pool.length)];
}

/** Semua frasa yang mungkin (untuk test keanggotaan). */
export function allGreetings(species: PetSpecies): string[] {
  return [...(BASE[species] ?? BASE.cat), ...RAIN, ...HUNGRY, ...HAPPY];
}
