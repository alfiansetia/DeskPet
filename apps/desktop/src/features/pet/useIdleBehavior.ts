/**
 * useIdleBehavior — Random idle micro-actions to make the pet feel alive.
 *
 * Aksi yang tersedia:
 *  - "jump"    : mainkan state jump (sprite jump.png) sebentar lalu kembali idle
 *  - "speak"   : mainkan state speak (gelembung bicara) sebentar
 *  - "react"   : mainkan state react (kaget/senang) sebentar
 *  - "stretch" : CSS-only — animasi dp-stretch (meregangkan badan di tempat)
 *  - "yawn"    : CSS-only — animasi dp-yawn (menguap sambil berkedip)
 *  - "wiggle"  : CSS-only — animasi dp-wiggle (menggoyang-goyangkan badan)
 *  - "emote"   : tampilkan emoji bubble kecil sesaat (💤 ♪ ✨ dst.)
 *  - "nothing" : tidak melakukan apa-apa (istirahat biasa)
 *
 * Aksi "state" (jump/speak/react) memanggil requestState dan akan auto-kembali
 * ke idle via TRANSIENT_TIMEOUT_MS di App.tsx (sudah ada).
 * Aksi "css" hanya menambahkan class ke elemen .dp-pet-wrap, dihapus setelah
 * durasi animasi selesai.
 */
import { useCallback, useEffect, useRef } from "react";
import type { PetState } from "./petStateMachine";

/** Aksi CSS-only (tidak mengubah PetState). */
export type IdleCssAnim = "stretch" | "yawn" | "wiggle";

/** Semua kemungkinan aksi idle. */
export type IdleActionKind =
  | "jump" | "speak" | "react"  // → ubah PetState
  | IdleCssAnim                  // → tambah CSS class
  | "emote"                      // → tampilkan emoji bubble
  | "nothing";                   // → diam saja

export interface IdleMicroEvent {
  kind: IdleActionKind;
  /** Emoji/teks untuk bubble micro (hanya untuk kind="emote"). */
  emote?: string;
}

interface Opts {
  enabled: boolean;
  petState: PetState;
  /** Paused saat: menu/panel terbuka, sedang drag, wander aktif, atau tidur. */
  paused: boolean;
  /** Dipanggil saat aksi terpilih — App.tsx yang menangani efeknya. */
  onIdleAction: (ev: IdleMicroEvent) => void;
}

// ─── Tabel aksi + bobot (total 100) ──────────────────────────────────────────
type ActionEntry = { kind: IdleActionKind; weight: number; emote?: string };
const ACTIONS: ActionEntry[] = [
  { kind: "jump",    weight: 18 },
  { kind: "speak",   weight: 10 },
  { kind: "react",   weight: 10 },
  { kind: "stretch", weight: 14 },
  { kind: "yawn",    weight: 12 },
  { kind: "wiggle",  weight: 10 },
  { kind: "emote",   weight: 16 },
  { kind: "nothing", weight: 10 },
];

const RANDOM_EMOTES = ["💤", "💭", "♪", "✨", "😺", "🐾", "💕", "❓", "😴", "🌟", "😸", "🎶"];

function pickAction(): IdleMicroEvent {
  const total = ACTIONS.reduce((s, a) => s + a.weight, 0);
  let r = Math.random() * total;
  for (const a of ACTIONS) {
    r -= a.weight;
    if (r <= 0) {
      if (a.kind === "emote") {
        const emote = RANDOM_EMOTES[Math.floor(Math.random() * RANDOM_EMOTES.length)];
        return { kind: "emote", emote };
      }
      return { kind: a.kind };
    }
  }
  return { kind: "nothing" };
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useIdleBehavior({ enabled, petState, paused, onIdleAction }: Opts) {
  const stateRef   = useRef(petState);   stateRef.current   = petState;
  const pausedRef  = useRef(paused);     pausedRef.current  = paused;
  const enabledRef = useRef(enabled);    enabledRef.current = enabled;
  const cbRef      = useRef(onIdleAction); cbRef.current    = onIdleAction;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Interval acak 5–15 detik agar terasa natural dan tidak terprediksi
    const delay = rand(5000, 15000);
    timerRef.current = setTimeout(() => {
      if (!enabledRef.current || pausedRef.current || stateRef.current !== "idle") {
        schedule(); // tunggu kondisi yang tepat
        return;
      }
      cbRef.current(pickAction());
      schedule(); // loop terus
    }, delay);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [enabled, schedule]);
}
