/** P1 pet state machine (frontend mirror). Rust is authoritative — this
 *  module only drives animation; transitions are validated in Rust via
 *  `pet_set_state`. Keep in sync with src-tauri/src/pet/state.rs.
 */

export type PetState =
  | "idle"
  | "walk"
  | "dragged"
  | "react"
  | "sleep"
  | "speak"
  | "reminder"
  | "attention"
  | "jump";

export const PET_STATES: PetState[] = [
  "idle",
  "walk",
  "dragged",
  "react",
  "sleep",
  "speak",
  "reminder",
  "attention",
  "jump",
];

export const TRANSIENT_STATES: PetState[] = ["react", "speak", "reminder", "attention", "jump"];

/** Frames per state for the placeholder sprite (CSS steps). Missing assets fall back to idle. */
export const STATE_FRAMES: Record<PetState, number> = {
  idle: 4,
  walk: 6,
  dragged: 2,
  react: 4,
  sleep: 4,
  speak: 4,
  reminder: 4,
  attention: 4,
  jump: 4,
};

export function isValidPetState(s: string): s is PetState {
  return (PET_STATES as string[]).includes(s);
}

/** Local transition guard (mirrors Rust `can_transition_to`). */
export function canTransitionTo(from: PetState, next: PetState): boolean {
  const f: string = from;
  const n: string = next;
  if (f === n) return true;
  if (n === "dragged") return true;
  if (f === "dragged" && n === "idle") return true;
  if (f === "sleep") {
    return n === "idle" || n === "react" || n === "attention" || n === "dragged";
  }
  return true;
}

/** Transient states auto-return to idle after this long (ms), unless reduced-motion keeps sleep. */
export const TRANSIENT_TIMEOUT_MS = 2500;
