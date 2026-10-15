/** Autonomous wander engine (PRD §5.1 "walk"). Moves the Tauri window; CSS fallback in preview. */
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import type { PetState } from "./petStateMachine";
import type { WanderPace as WanderPacePref, WanderDirection as WanderDirectionPref } from "../../lib/store";

export type WalkPace = "slow" | "normal" | "fast";

interface Opts {
  enabled: boolean;
  wanderPace?: WanderPacePref;
  wanderDirection?: WanderDirectionPref;
  petState: PetState;
  reducedMotion: boolean;
  paused: boolean; // menu/panel open, dragging, sleeping
  requestState: (s: PetState) => void;
  /** Delay awal (ms) agar N pet tidak start bareng. Default 0. */
  startDelayMs?: number;
}

interface MoveLeg {
  targetX: number;
  targetY: number;
  pace: WalkPace;
  pauseAfterMs?: number;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function resolvePace(pref: WanderPacePref): WalkPace {
  if (pref === "slow") return "slow";
  if (pref === "fast") return "fast";
  if (pref === "normal") return "normal";
  // "random": acak antara lari cepat, santai, dan normal
  const r = Math.random();
  if (r < 0.45) return "fast";
  if (r < 0.75) return "slow";
  return "normal";
}

export interface WanderPads { padL: number; padR: number; padT: number; padB: number }
export interface WanderBounds { minX: number; maxX: number; minY: number; maxY: number }
export interface WorkArea { left: number; top: number; right: number; bottom: number }

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Keputusan auto-center saat alert penting: user bisa mematikan lewat
 * `centerOnAlert` (simpanan lama tanpa field = tetap aktif); panel yang
 * sedang terbuka tidak diganggu posisinya.
 */
export function shouldCenterPet(centerOnAlert: boolean | undefined, panelOpen: boolean): boolean {
  return centerOnAlert !== false && !panelOpen;
}

/** Sisi kursor relatif ke tengah pet (untuk menoleh): kanan -> 1, kiri -> -1. */
export function sideOf(cursorX: number, centerX: number): 1 | -1 {
  return cursorX >= centerX ? 1 : -1;
}

/** Indeks tepi layar: 0=atas, 1=kanan, 2=bawah, 3=kiri (searah jarum jam). */
export type EdgeIndex = 0 | 1 | 2 | 3;

/** Tepi terdekat dari posisi (x,y) terhadap bounds (untuk mode "edges"). */
export function nearestEdge(x: number, y: number, b: WanderBounds): EdgeIndex {
  const d = [y - b.minY, b.maxX - x, b.maxY - y, x - b.minX];
  let best: EdgeIndex = 0;
  for (let i = 1; i < 4; i++) if (d[i] < d[best]) best = i as EdgeIndex;
  return best;
}

/** Proyeksi terdekat (x,y) ke sebuah tepi — titik mentok di tepi itu. */
export function nearestPointOnEdge(
  x: number, y: number, b: WanderBounds, edge: EdgeIndex,
): { x: number; y: number } {
  switch (edge) {
    case 0: return { x: clamp(x, b.minX, b.maxX), y: b.minY };
    case 1: return { x: b.maxX, y: clamp(y, b.minY, b.maxY) };
    case 2: return { x: clamp(x, b.minX, b.maxX), y: b.maxY };
    case 3: return { x: b.minX, y: clamp(y, b.minY, b.maxY) };
  }
}

/** Rentang segmen tepi dekat sudut bersama untuk langkah keliling.
 *  step=1 (searah jarum jam): sudut bersama di s=0 sisi target -> [0, 0.5].
 *  step=3 (mundur/ccw): sudut bersama di s=1 sisi target -> [0.5, 1]. */
export function edgeStepRange(step: 1 | 3): { sMin: number; sMax: number } {
  return step === 1 ? { sMin: 0, sMax: 0.5 } : { sMin: 0.5, sMax: 1 };
}

/** Titik acak di sepanjang tepi (mentok, bounds sudah sprite-aware).
 *  sMin/sMax membatasi segmen tepi (0=ujung awal, 1=ujung akhir searah jarum
 *  jam) — untuk mode keliling, batasi ke setengah dekat sudut bersama agar
 *  garis jalan tetap di periferi, tidak melintas tengah layar.
 *  Ujung tiap tepi (searah jarum jam): top: kiri->kanan, right: atas->bawah,
 *  bottom: kanan->kiri, left: bawah->atas. */
export function randomPointOnEdge(
  edge: EdgeIndex, b: WanderBounds, sMin = 0, sMax = 1,
): { x: number; y: number } {
  const s = sMin + Math.random() * (sMax - sMin);
  const spanX = b.maxX - b.minX, spanY = b.maxY - b.minY;
  switch (edge) {
    case 0: return { x: b.minX + s * spanX, y: b.minY };
    case 1: return { x: b.maxX, y: b.minY + s * spanY };
    case 2: return { x: b.maxX - s * spanX, y: b.maxY };
    case 3: return { x: b.minX, y: b.maxY - s * spanY };
  }
}

/** Padding sprite (CSS px) dari rect .dp-pet-wrap terhadap viewport window. */
export function spritePads(
  vw: number, vh: number,
  r: { left: number; top: number; right: number; bottom: number } | null | undefined,
): WanderPads {
  const F = 16; // window tight (sprite 128px + breathing) -> padding kecil
  if (!r) return { padL: F, padR: F, padT: F, padB: F };
  return {
    padL: Math.max(0, r.left),
    padR: Math.max(0, vw - r.right),
    padT: Math.max(0, r.top),
    padB: Math.max(0, vh - r.bottom),
  };
}

/**
 * Work-area OS (taskbar/dock sudah dikecualikan) dari window.screen.
 * Mengembalikan koordinat physical px (CSS * scale) agar konsisten dengan
 * outerPosition/outerSize/monitor yang semuanya physical.
 */
export function readWorkAreaPhysical(scale: number): WorkArea | null {
  try {
    const s = window.screen as Screen & { availTop?: number; availLeft?: number };
    const availW = s.availWidth || 0;
    const availH = s.availHeight || 0;
    if (availW <= 0 || availH <= 0) return null;
    const left = (s.availLeft || 0) * scale;
    const top = (s.availTop || 0) * scale;
    return { left, top, right: left + availW * scale, bottom: top + availH * scale };
  } catch { return null; }
}

/**
 * Batas posisi window (physical px) agar sprite MENTOK ke tepi limit.
 * limit = work-area monitor (tepi bawah = atas taskbar, bukan bawah layar).
 * Bila limits null (work-area tak terbaca) pakai fallback taskbar 48px.
 */
export function tauriBounds(
  monX: number, monY: number, monW: number, monH: number,
  winW: number, winH: number, pads: WanderPads, scale: number,
  limits?: WorkArea | null,
): WanderBounds {
  let limL = monX, limT = monY, limR = monX + monW, limB = monY + monH;
  if (limits) {
    limL = Math.max(limL, limits.left);
    limT = Math.max(limT, limits.top);
    limR = Math.min(limR, limits.right);
    limB = Math.min(limB, limits.bottom);
  } else {
    limB -= Math.round(48 * scale); // fallback taskbar bila work-area tak terbaca
  }
  const minX = Math.round(limL - pads.padL * scale);
  const maxX = Math.round(limR - winW + pads.padR * scale);
  const minY = Math.round(limT - pads.padT * scale);
  const maxY = Math.round(limB - winH + pads.padB * scale);
  return {
    minX,
    maxX: maxX > minX ? maxX : minX + 500,
    minY,
    maxY: maxY > minY ? maxY : minY + 300,
  };
}

/**
 * Batas web-preview (CSS px, koordinat relatif tengah): sprite mentok ke tepi
 * viewport + margin kecil. halfW/halfH = setengah ukuran sprite terukur.
 */
export function previewBounds(pw: number, ph: number, halfW: number, halfH: number, margin = 4): WanderBounds {
  const hw = Math.max(0, halfW), hh = Math.max(0, halfH);
  const minX = -Math.round(pw / 2) + Math.round(hw) + margin;
  const maxX = Math.round(pw / 2) - Math.round(hw) - margin;
  const minY = -Math.round(ph / 2) + Math.round(hh) + margin;
  const maxY = Math.round(ph / 2) - Math.round(hh) - margin;
  return {
    minX,
    maxX: maxX > minX ? maxX : minX + 200,
    minY,
    maxY: maxY > minY ? maxY : minY + 200,
  };
}

export function useWander({
  enabled,
  wanderPace = "random",
  wanderDirection = "random",
  petState,
  reducedMotion,
  paused,
  requestState,
  startDelayMs = 0,
}: Opts) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walkSpeed, setWalkSpeed] = useState<WalkPace>("normal");
  const busy = useRef(false);
  const reqRef = useRef(requestState);
  reqRef.current = requestState;

  // Latest gating flags via refs
  const stateRef = useRef(petState);
  stateRef.current = petState;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const pacePrefRef = useRef(wanderPace);
  pacePrefRef.current = wanderPace;
  const dirPrefRef = useRef(wanderDirection);
  dirPrefRef.current = wanderDirection;
  const motionRef = useRef(reducedMotion);
  motionRef.current = reducedMotion;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  // Kursor tepi untuk mode "edges": dipertahankan antar siklus agar jalan
  // mengikuti keliling (tepi → tepi sebelahnya), di-reset tiap efek
  // di-restart (ganti setting/jeda) agar sinkron ulang ke posisi nyata.
  const edgeRef = useRef<EdgeIndex | null>(null);

  const blocked = petState === "sleep" || petState === "dragged";

  useEffect(() => {
    if (!enabled || reducedMotion || paused || blocked) return;
    edgeRef.current = null; // sinkron ulang tepi dari posisi saat ini
    let cancelled = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    let isFirst = true;
    const schedule = (immediate = false) => {
      if (cancelled) return;
      // Saat awal atau baru ganti settingan, langsung jalan dalam 700ms agar instan terasa!
      // startDelayMs (multi-pet) hanya menunda start PERTAMA agar tidak sinkron.
      const base = immediate ? 250 : isFirst ? 700 : rand(3000, 6000);
      const delay = isFirst ? base + Math.max(0, startDelayMs) : base;
      isFirst = false;
      idleTimer = setTimeout(() => { void executeWander(); }, delay);
    };

    const executeWander = async () => {
      if (cancelled || busy.current) { schedule(); return; }
      if (!enabledRef.current || motionRef.current || pausedRef.current) { schedule(); return; }
      if (stateRef.current !== "idle") { schedule(); return; }
      busy.current = true;

      try {
        // 1. Tentukan batas layar monitor fisik secara akurat (mentok sampai pinggir)
        let w: ReturnType<typeof getCurrentWindow> | null = null;
        let pos = { x: 500, y: 500 };
        let scale = 1;
        let minX = 0;
        let maxX = 1700;
        let minY = 0;
        let maxY = 850;

        try {
          w = getCurrentWindow();
          const p = await w.outerPosition();
          pos = { x: p.x, y: p.y };
          scale = await w.scaleFactor().catch(() => 1);
          const mon = await currentMonitor().catch(() => null);
          // Ukuran window AKTUAL (diukur, bukan asumsi): App me-resize window
          // tight mengikuti sprite (128px*scale + breathing), melebar saat
          // pill countdown / bubble / alert. Fallback pakai innerWidth agar
          // tetap dinamis bila outerSize gagal dibaca.
          let winW = Math.round((window.innerWidth || 96) * scale);
          let winH = Math.round((window.innerHeight || 102) * scale);
          try {
            const s = await w.outerSize();
            if (s.width > 0 && s.height > 0) { winW = s.width; winH = s.height; }
          } catch { /* fallback innerWidth */ }
          // Posisi sprite di DALAM window (CSS px, diukur live): sprite selalu
          // di tengah horizontal; vertikal tergantung bubble/panel. Dengan
          // begitu batas mentok cocok di semua ukuran window & skala device.
          let pads: WanderPads = { padL: 16, padR: 16, padT: 16, padB: 16 };
          try {
            const vw = window.innerWidth || 96;
            const vh = window.innerHeight || 102;
            const r = document.querySelector(".dp-pet-wrap")?.getBoundingClientRect();
            if (r && r.width > 0 && r.height > 0) pads = spritePads(vw, vh, r);
          } catch { /* fallback 16 */ }

          if (mon) {
            // Work-area (taskbar dikecualikan) hanya valid untuk monitor utama
            // (primary di 0,0). Monitor sekunder tak punya taskbar -> pakai
            // rect monitor penuh agar bawah juga mentok.
            const isPrimary = mon.position.x === 0 && mon.position.y === 0;
            const work = isPrimary ? readWorkAreaPhysical(scale) : null;
            const limits: WorkArea | null = work ?? (isPrimary ? null : {
              left: mon.position.x, top: mon.position.y,
              right: mon.position.x + mon.size.width,
              bottom: mon.position.y + mon.size.height,
            });
            const b = tauriBounds(
              mon.position.x, mon.position.y, mon.size.width, mon.size.height,
              winW, winH, pads, scale, limits,
            );
            minX = b.minX; maxX = b.maxX; minY = b.minY; maxY = b.maxY;
          } else {
            // Tanpa info monitor: pakai work-area OS langsung (availWidth/
            // availHeight SUDAH mengecualikan taskbar -> jangan kurangi lagi,
            // kalau dikurangi dua kali bawah jadi menggantung 48px).
            const work = readWorkAreaPhysical(scale);
            if (work) {
              minX = Math.round(work.left - pads.padL * scale);
              maxX = Math.round(work.right - winW + pads.padR * scale);
              minY = Math.round(work.top - pads.padT * scale);
              maxY = Math.round(work.bottom - winH + pads.padB * scale);
              if (maxX <= minX) maxX = minX + 500;
              if (maxY <= minY) maxY = minY + 300;
            } else {
              const sw = (window.screen.availWidth || 1920) * scale;
              const sh = (window.screen.availHeight || 1080) * scale;
              const taskbar = Math.round(48 * scale);
              minX = -Math.round(pads.padL * scale);
              maxX = Math.round(sw - winW + pads.padR * scale);
              minY = -Math.round(pads.padT * scale);
              maxY = Math.round(sh - winH + pads.padB * scale - taskbar);
              if (maxX <= minX) maxX = minX + 500;
              if (maxY <= minY) maxY = minY + 300;
            }
          }
        } catch {
          // Web preview mode (area browser): koordinat relatif tengah.
          // Batas memperhitungkan setengah ukuran sprite agar badan kucing
          // yang mentok ke tepi (bukan titik tengahnya, yang bikin kepotong
          // setengah badan di semua sisi).
          w = null;
          const pw = Math.max(window.innerWidth || 800, 500);
          const ph = Math.max(window.innerHeight || 600, 400);
          let halfW = 64, halfH = 64;
          try {
            const r = document.querySelector(".dp-pet-wrap")?.getBoundingClientRect();
            if (r && r.width > 0 && r.height > 0) { halfW = r.width / 2; halfH = r.height / 2; }
          } catch { /* fallback 64 */ }
          const b = previewBounds(pw, ph, halfW, halfH, 4);
          minX = b.minX; maxX = b.maxX; minY = b.minY; maxY = b.maxY;
          pos = { x: offsetRef.current.x, y: offsetRef.current.y };
        }

        // 2. Bangun lintasan ujung-ke-ujung (Desktop-wide Patrol mentok ke pinggir)
        const pacePref = pacePrefRef.current;
        const dirPref = dirPrefRef.current;

        // Tentukan pola lintasan
        let pattern: "horizontal" | "vertical" | "diagonal" | "edges";
        if (dirPref === "horizontal") {
          pattern = "horizontal";
        } else if (dirPref === "vertical") {
          pattern = "vertical";
        } else if (dirPref === "edges") {
          pattern = "edges";
        } else {
          // Mode acak: 50% sweep kiri-kanan penuh, 30% sweep vertikal penuh, 20% diagonal silang
          const r = Math.random();
          if (r < 0.50) pattern = "horizontal";
          else if (r < 0.80) pattern = "vertical";
          else pattern = "diagonal";
        }

        const legs: MoveLeg[] = [];

        if (pattern === "horizontal") {
          // POLA KIRI – KANAN UJUNG KE UJUNG:
          // Dari ujung desktop satu ke ujung desktop yang berlawanan MENTOK, berhenti sejenak, lalu balik lagi!
          const midX = (minX + maxX) / 2;
          const startsNearLeft = pos.x < midX;

          const targetRightX = maxX; // MENTOK KE PINGGIR KANAN!
          const targetLeftX = minX;  // MENTOK KE PINGGIR KIRI!

          const leg1Pace = resolvePace(pacePref);
          const leg2Pace = resolvePace(pacePref);

          if (startsNearLeft) {
            // Lari dari kiri menyeberang MENTOK ke ujung kanan desktop
            legs.push({
              targetX: targetRightX,
              targetY: Math.min(maxY, Math.max(minY, pos.y)),
              pace: leg1Pace,
              pauseAfterMs: rand(550, 850), // Berhenti di ujung kanan, menoleh
            });
            // Lalu lari balik menyeberang MENTOK ke ujung kiri desktop
            legs.push({
              targetX: targetLeftX,
              targetY: Math.min(maxY, Math.max(minY, pos.y)),
              pace: leg2Pace,
            });
          } else {
            // Lari dari kanan menyeberang MENTOK ke ujung kiri desktop
            legs.push({
              targetX: targetLeftX,
              targetY: Math.min(maxY, Math.max(minY, pos.y)),
              pace: leg1Pace,
              pauseAfterMs: rand(550, 850), // Berhenti di ujung kiri, menoleh
            });
            // Lalu lari balik menyeberang MENTOK ke ujung kanan desktop
            legs.push({
              targetX: targetRightX,
              targetY: Math.min(maxY, Math.max(minY, pos.y)),
              pace: leg2Pace,
            });
          }
        } else if (pattern === "vertical") {
          // POLA ATAS – BAWAH UJUNG KE UJUNG:
          // Meluncur dari ujung bawah (taskbar) MENTOK ke ujung paling atas layar atau sebaliknya
          const midY = (minY + maxY) / 2;
          const startsNearBottom = pos.y > midY;

          const targetTopY = minY; // MENTOK KE PINGGIR ATAS!
          const targetBottomY = maxY; // MENTOK KE ATAS TASKBAR!

          const leg1Pace = resolvePace(pacePref);
          const leg2Pace = resolvePace(pacePref);

          if (startsNearBottom) {
            legs.push({
              targetX: Math.min(maxX, Math.max(minX, pos.x)),
              targetY: targetTopY,
              pace: leg1Pace,
              pauseAfterMs: rand(500, 750),
            });
            legs.push({
              targetX: Math.min(maxX, Math.max(minX, pos.x)),
              targetY: targetBottomY,
              pace: leg2Pace,
            });
          } else {
            legs.push({
              targetX: Math.min(maxX, Math.max(minX, pos.x)),
              targetY: targetBottomY,
              pace: leg1Pace,
              pauseAfterMs: rand(500, 750),
            });
            legs.push({
              targetX: Math.min(maxX, Math.max(minX, pos.x)),
              targetY: targetTopY,
              pace: leg2Pace,
            });
          }
        } else if (pattern === "edges") {
          // POLA PINGGIR (keliling tepi layar, acak tapi tetap di pinggir):
          // dari tepi terdekat -> titik acak di tepi SEBELAHNYA (searah /
          // berlawanan jarum jam, acak tiap siklus), lalu lanjut ke tepi
          // sebelahnya lagi. Target dibatasi setengah tepi dekat sudut
          // bersama (s-range) agar garis antar tepi bersebelahan hanya
          // memotong sudut — tetap di periferi, tidak pernah melintas tengah
          // layar. Tanpa s-range (full edge), garis dari ujung jauh ke ujung
          // jauh = diagonal nyeberang tengah (itu bug-nya).
          const b = { minX, maxX, minY, maxY };
          const isFirstSync = edgeRef.current === null;
          const cur = edgeRef.current ?? nearestEdge(pos.x, pos.y, b);
          const step: 1 | 3 = Math.random() < 0.5 ? 1 : 3; // 1=searah, 3=mundur (= -1 mod 4)
          const next1 = ((cur + step) % 4) as EdgeIndex;
          const next2 = ((next1 + step) % 4) as EdgeIndex;
          const { sMin, sMax } = edgeStepRange(step);
          // Sinkron awal: posisi bisa di tengah layar (mis. habis alert yang
          // centerPet, atau baru ganti setting). Mampir dulu ke titik
          // terdekat di tepi saat ini (jalur tegak lurus terpendek), baru
          // mulai keliling — tanpa ini leg pertama diagonal dari tengah ke
          // tepi sebelah = nyeberang tengah.
          if (isFirstSync) {
            const sync = nearestPointOnEdge(pos.x, pos.y, b, cur);
            legs.push({
              targetX: sync.x,
              targetY: sync.y,
              pace: resolvePace(pacePref),
              pauseAfterMs: rand(300, 500),
            });
          }
          const t1 = randomPointOnEdge(next1, b, sMin, sMax);
          const t2 = randomPointOnEdge(next2, b, sMin, sMax);
          legs.push({
            targetX: t1.x,
            targetY: t1.y,
            pace: resolvePace(pacePref),
            pauseAfterMs: rand(400, 700),
          });
          legs.push({
            targetX: t2.x,
            targetY: t2.y,
            pace: resolvePace(pacePref),
          });
          edgeRef.current = next2;
        } else {
          // POLA DIAGONAL SILANG (Pojok ke Pojok Seberang MENTOK):
          const midX = (minX + maxX) / 2;
          const midY = (minY + maxY) / 2;

          const targetCornerX = pos.x < midX ? maxX : minX;
          const targetCornerY = pos.y < midY ? maxY : minY;

          legs.push({
            targetX: targetCornerX,
            targetY: targetCornerY,
            pace: resolvePace(pacePref),
            pauseAfterMs: rand(500, 800),
          });
        }

        // 3. Eksekusi setiap lintasan dengan pergerakan halus (smooth physics interpolation)
        for (let legIdx = 0; legIdx < legs.length; legIdx++) {
          const leg = legs[legIdx];
          if (cancelled || pausedRef.current || !enabledRef.current) break;
          const sNow = stateRef.current as PetState;
          if (sNow === "dragged" || sNow === "sleep") break;

          const startX = pos.x;
          const startY = pos.y;
          const targetX = leg.targetX;
          const targetY = leg.targetY;
          const dx = targetX - startX;
          const dy = targetY - startY;
          const distance = Math.hypot(dx, dy);

          if (distance < 5) continue;

          // Pasang arah hadap (flip horizontally saat berbalik)
          if (Math.abs(dx) > 5) {
            setFacing(dx >= 0 ? 1 : -1);
          }
          setWalkSpeed(leg.pace);

          try {
            reqRef.current("walk");
          } catch { /* noop */ }

          // Kecepatan langkah (kecepatan nyata dalam pixel per detik):
          // fast   : lari cepat ~520 px/sec (interval 16ms, ~8.3 px/step)
          // normal : jalan sedang ~260 px/sec (interval 22ms, ~5.7 px/step)
          // slow   : jalan pelan ~130 px/sec (interval 35ms, ~4.5 px/step)
          const stepDelay = leg.pace === "fast" ? 16 : leg.pace === "slow" ? 35 : 22;
          const pxPerStep = leg.pace === "fast" ? 8.3 : leg.pace === "slow" ? 4.5 : 5.7;
          const steps = Math.max(20, Math.round(distance / pxPerStep));

          for (let step = 1; step <= steps; step++) {
            if (cancelled || pausedRef.current || !enabledRef.current) break;
            const sInner = stateRef.current as PetState;
            if (sInner === "dragged" || sInner === "sleep") break;

            const progress = step / steps;
            const curX = startX + dx * progress;
            const curY = startY + dy * progress;

            if (w) {
              try {
                await w.setPosition(new PhysicalPosition(Math.round(curX), Math.round(curY)));
                pos = { x: curX, y: curY };
              } catch {
                offsetRef.current = { x: curX, y: curY };
                setOffset({ x: curX, y: curY });
                pos = { x: curX, y: curY };
              }
            } else {
              offsetRef.current = { x: curX, y: curY };
              setOffset({ x: curX, y: curY });
              pos = { x: curX, y: curY };
            }

            await new Promise((r) => setTimeout(r, stepDelay));
          }

          // Jika ada jeda di ujung (berhenti sejenak, menolehkan kepala sebelum lari balik)
          if (leg.pauseAfterMs && !cancelled && !pausedRef.current) {
            try { reqRef.current("idle"); } catch { /* noop */ }
            const nextLeg = legs[legIdx + 1];
            if (nextLeg && Math.abs(nextLeg.targetX - pos.x) > 5) {
              // Menoleh ke arah berlawanan sebelum melangkah kembali
              setFacing(nextLeg.targetX >= pos.x ? 1 : -1);
            }
            await new Promise((r) => setTimeout(r, leg.pauseAfterMs));
          }
        }

        if (!cancelled) {
          setWalkSpeed("normal");
          try { reqRef.current("idle"); } catch { /* noop */ }
        }
      } finally {
        busy.current = false;
        schedule();
      }
    };

    schedule();
    return () => {
      cancelled = true;
      if (idleTimer) clearTimeout(idleTimer);
      busy.current = false;
      setWalkSpeed("normal");
      try { reqRef.current("idle"); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, wanderPace, wanderDirection, reducedMotion, paused, blocked, startDelayMs]);

  // Kembalikan pet ke tengah layar saat alert penting agar jadi fokus.
  // Tauri: pindahkan window OS ke tengah monitor aktif. Web preview:
  // reset offset CSS ke tengah. Selalu resolve (fallback aman) agar
  // caller cukup `void centerPet()`.
  const centerPet = useCallback(async (): Promise<void> => {
    try {
      const w = getCurrentWindow();
      const scale = await w.scaleFactor().catch(() => 1);
      const mon = await currentMonitor().catch(() => null);
      if (!mon) throw new Error("no monitor info");
      let winW = Math.round((window.innerWidth || 96) * scale);
      let winH = Math.round((window.innerHeight || 102) * scale);
      try {
        const s = await w.outerSize();
        if (s.width > 0 && s.height > 0) { winW = s.width; winH = s.height; }
      } catch { /* fallback innerWidth */ }
      const cx = Math.round(mon.position.x + mon.size.width / 2 - winW / 2);
      const cy = Math.round(mon.position.y + mon.size.height / 2 - winH / 2);
      await w.setPosition(new PhysicalPosition(cx, cy));
    } catch {
      offsetRef.current = { x: 0, y: 0 };
      setOffset({ x: 0, y: 0 });
    }
  }, []);

  return { offset, facing, walkSpeed, centerPet };
}
