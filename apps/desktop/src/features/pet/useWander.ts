/** Autonomous wander engine (PRD §5.1 "walk"). Moves the Tauri window; CSS fallback in preview. */
import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
}

interface MoveSegment {
  dx: number;
  dy: number;
  pace: WalkPace;
  pauseAfterMs?: number;
  pauseFacing?: 1 | -1;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function resolvePace(pref: WanderPacePref): WalkPace {
  if (pref === "slow") return "slow";
  if (pref === "fast") return "fast";
  if (pref === "normal") return "normal";
  // "random"
  const r = Math.random();
  if (r < 0.40) return "fast";
  if (r < 0.75) return "slow";
  return "normal";
}

export function useWander({
  enabled,
  wanderPace = "random",
  wanderDirection = "random",
  petState,
  reducedMotion,
  paused,
  requestState,
}: Opts) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walkSpeed, setWalkSpeed] = useState<WalkPace>("normal");
  const busy = useRef(false);
  const reqRef = useRef(requestState);
  reqRef.current = requestState;

  // Latest gating flags via refs so loop doesn't restart on self-triggered state changes
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

  const blocked = petState === "sleep" || petState === "dragged";

  useEffect(() => {
    if (!enabled || reducedMotion || paused || blocked) return;
    let cancelled = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    let isFirst = true;
    const schedule = () => {
      if (cancelled) return;
      // Stroll pertama muncul cepat (1.5 - 2.8 detik) agar langsung terlihat,
      // lalu bergantian setiap 3.5 - 6.5 detik
      const delay = isFirst ? rand(1500, 2800) : rand(3500, 6500);
      isFirst = false;
      idleTimer = setTimeout(() => { void executeWander(); }, delay);
    };

    const executeWander = async () => {
      if (cancelled || busy.current) { schedule(); return; }
      if (!enabledRef.current || motionRef.current || pausedRef.current) { schedule(); return; }
      if (stateRef.current !== "idle") { schedule(); return; }
      busy.current = true;

      try {
        // 1. Tentukan posisi window & batas layar saat ini
        let w: ReturnType<typeof getCurrentWindow> | null = null;
        let pos = { x: 500, y: 500 };
        let scale = 1;
        let sw = 1920;
        let sh = 1080;

        try {
          w = getCurrentWindow();
          const p = await w.outerPosition();
          pos = { x: p.x, y: p.y };
          scale = await w.scaleFactor().catch(() => 1);
          sw = (window.screen.availWidth || 1920) * scale;
          sh = (window.screen.availHeight || 1080) * scale;
        } catch {
          w = null;
        }

        // 2. Deteksi batas layar dan tentukan kelayakan arah gerak
        let canGoLeft = true;
        let canGoRight = true;
        let canGoUp = true;
        let canGoDown = true;

        if (w) {
          const marginH = 180 * scale;
          const marginV = 140 * scale;
          canGoLeft = pos.x > marginH;
          canGoRight = pos.x < sw - marginH - 240 * scale;
          canGoUp = pos.y > marginV;
          canGoDown = pos.y < sh - marginV - 240 * scale;
        } else {
          // Web preview mode boundaries
          canGoLeft = offsetRef.current.x > -110;
          canGoRight = offsetRef.current.x < 110;
          canGoUp = offsetRef.current.y > -70;
          canGoDown = offsetRef.current.y < 70;
        }

        const dirX = (canGoLeft && canGoRight)
          ? (Math.random() > 0.5 ? 1 : -1)
          : (canGoRight ? 1 : -1);

        const dirY = (canGoUp && canGoDown)
          ? (Math.random() > 0.5 ? 1 : -1)
          : (canGoDown ? 1 : -1);

        // 3. Bangun segmen pergerakan berdasarkan 2 parameter terpisah:
        // Parameter 1: pacePrefRef.current ("random" | "slow" | "normal" | "fast")
        // Parameter 2: dirPrefRef.current  ("random" | "horizontal" | "vertical")
        const pacePref = pacePrefRef.current;
        const dirPref = dirPrefRef.current;

        // Tentukan pola lintasan (trajectory)
        let trajectory: "horizontal" | "vertical" | "zigzag" | "direct";
        if (dirPref === "horizontal") {
          trajectory = "horizontal";
        } else if (dirPref === "vertical") {
          trajectory = "vertical";
        } else {
          // Acak: campur antara horizontal, vertikal, zig-zag, dan jelajah langsung
          const roll = Math.random();
          if (roll < 0.35) trajectory = "horizontal";
          else if (roll < 0.65) trajectory = "vertical";
          else if (roll < 0.85) trajectory = "zigzag";
          else trajectory = "direct";
        }

        const segments: MoveSegment[] = [];

        if (trajectory === "horizontal") {
          // Pola Kiri – Kanan (Patroli Horizontal Bolak-Balik)
          const firstDirX = dirX;
          const secondDirX = -firstDirX as (1 | -1);
          const pace1 = resolvePace(pacePref);
          const pace2 = resolvePace(pacePref);

          segments.push({
            dx: firstDirX * rand(90, 170),
            dy: dirY * rand(5, 25),
            pace: pace1,
            pauseAfterMs: rand(450, 750),
            pauseFacing: secondDirX, // Menoleh berbalik sebelum langkah kedua
          });
          segments.push({
            dx: secondDirX * rand(100, 190),
            dy: -dirY * rand(5, 25),
            pace: pace2,
          });
        } else if (trajectory === "vertical") {
          // Pola Atas – Bawah (Eksplorasi Vertikal Tegas)
          const vertDirY = dirY;
          const pace1 = resolvePace(pacePref);

          segments.push({
            dx: (Math.random() > 0.5 ? 1 : -1) * rand(15, 45),
            dy: vertDirY * rand(130, 220),
            pace: pace1,
            pauseAfterMs: rand(400, 650),
          });
          // Kemungkinan lanjut kembali atau langkah vertikal kedua
          if (Math.random() > 0.4) {
            const pace2 = resolvePace(pacePref);
            segments.push({
              dx: (Math.random() > 0.5 ? 1 : -1) * rand(20, 50),
              dy: -vertDirY * rand(70, 130),
              pace: pace2,
            });
          }
        } else if (trajectory === "zigzag") {
          // Pola Zig-Zag Multi-Arah
          const seg1DirX = dirX;
          const seg2DirX = -seg1DirX as (1 | -1);
          const pace1 = resolvePace(pacePref);
          const pace2 = resolvePace(pacePref);

          segments.push({
            dx: seg1DirX * rand(80, 140),
            dy: dirY * rand(40, 75),
            pace: pace1,
            pauseAfterMs: rand(350, 550),
            pauseFacing: seg2DirX,
          });
          segments.push({
            dx: seg2DirX * rand(90, 150),
            dy: (Math.random() > 0.5 ? dirY : -dirY) * rand(35, 70),
            pace: pace2,
          });
        } else {
          // Pola Jelajah Langsung (Direct Stroll / Sprint)
          const pace = resolvePace(pacePref);
          const distMultiplier = pace === "fast" ? 1.4 : pace === "slow" ? 0.75 : 1;

          segments.push({
            dx: dirX * rand(110, 180) * distMultiplier,
            dy: dirY * rand(30, 70) * distMultiplier,
            pace,
            pauseAfterMs: rand(400, 700),
            pauseFacing: Math.random() > 0.5 ? (-dirX as (1 | -1)) : (dirX as (1 | -1)),
          });
        }

        // 4. Eksekusi setiap segmen gerakan
        for (const seg of segments) {
          if (cancelled || pausedRef.current || !enabledRef.current) break;
          const sNow = stateRef.current as PetState;
          if (sNow === "dragged" || sNow === "sleep") break;

          // Pasang arah hadap dan kecepatan animasi
          if (seg.dx !== 0) {
            setFacing(seg.dx >= 0 ? 1 : -1);
          }
          setWalkSpeed(seg.pace);

          try {
            reqRef.current("walk");
          } catch { /* noop */ }

          // Konfigurasi kecepatan langkah per segmen:
          // fast   : langkah sangat cepat & lincah (delay 15ms)
          // normal : langkah wajar (delay 30ms)
          // slow   : langkah santai & mengendap (delay 48ms)
          const stepDelay = seg.pace === "fast" ? 15 : seg.pace === "slow" ? 48 : 30;
          const steps = seg.pace === "fast" ? 28 : seg.pace === "slow" ? 34 : 30;

          if (w) {
            try {
              const currentP = await w.outerPosition();
              const startX = currentP.x;
              const startY = currentP.y;
              const physDx = seg.dx * scale;
              const physDy = seg.dy * scale;
              const stepX = physDx / steps;
              const stepY = physDy / steps;

              for (let i = 1; i <= steps; i++) {
                if (cancelled || pausedRef.current || !enabledRef.current) break;
                const sInner = stateRef.current as PetState;
                if (sInner === "dragged" || sInner === "sleep") break;

                const targetX = Math.min(Math.max(startX + stepX * i, 0), Math.max(sw - 240 * scale, 0));
                const targetY = Math.min(Math.max(startY + stepY * i, 0), Math.max(sh - 240 * scale, 0));

                await w.setPosition(new PhysicalPosition(Math.round(targetX), Math.round(targetY)));
                pos = { x: targetX, y: targetY };
                await new Promise((r) => setTimeout(r, stepDelay));
              }
            } catch {
              // fallback preview
              for (let i = 1; i <= steps; i++) {
                if (cancelled || pausedRef.current || !enabledRef.current) break;
                const nextX = Math.max(-190, Math.min(190, offsetRef.current.x + (seg.dx / steps) * 0.55));
                const nextY = Math.max(-110, Math.min(110, offsetRef.current.y + (seg.dy / steps) * 0.55));
                offsetRef.current = { x: nextX, y: nextY };
                setOffset({ x: nextX, y: nextY });
                await new Promise((r) => setTimeout(r, stepDelay));
              }
            }
          } else {
            // Web preview mode
            for (let i = 1; i <= steps; i++) {
              if (cancelled || pausedRef.current || !enabledRef.current) break;
              const nextX = Math.max(-190, Math.min(190, offsetRef.current.x + (seg.dx / steps) * 0.55));
              const nextY = Math.max(-110, Math.min(110, offsetRef.current.y + (seg.dy / steps) * 0.55));
              offsetRef.current = { x: nextX, y: nextY };
              setOffset({ x: nextX, y: nextY });
              await new Promise((r) => setTimeout(r, stepDelay));
            }
          }

          // Jika ada jeda antar segmen (misal berhenti sejenak melihat-lihat atau menoleh)
          if (seg.pauseAfterMs && !cancelled && !pausedRef.current) {
            try { reqRef.current("idle"); } catch { /* noop */ }
            if (seg.pauseFacing) {
              setFacing(seg.pauseFacing);
            }
            await new Promise((r) => setTimeout(r, seg.pauseAfterMs));
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reducedMotion, paused, blocked]);

  return { offset, facing, walkSpeed };
}
