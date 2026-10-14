/** Autonomous wander engine (PRD §5.1 "walk"). Moves the Tauri window; CSS fallback in preview. */
import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { PetState } from "./petStateMachine";

interface Opts {
  enabled: boolean;
  petState: PetState;
  reducedMotion: boolean;
  paused: boolean; // menu/panel open, dragging, sleeping
  requestState: (s: PetState) => void;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function useWander({ enabled, petState, reducedMotion, paused, requestState }: Opts) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [facing, setFacing] = useState<1 | -1>(1);
  const busy = useRef(false);
  const reqRef = useRef(requestState);
  reqRef.current = requestState;

  useEffect(() => {
    if (!enabled || reducedMotion || paused) return;
    if (petState === "sleep" || petState === "dragged") return;
    let cancelled = false;
    let idleTimer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      idleTimer = setTimeout(() => { void stroll(); }, rand(5000, 11000));
    };

    const stroll = async () => {
      if (cancelled || busy.current) { schedule(); return; }
      // Only stroll from idle (don't interrupt user-triggered states)
      busy.current = true;
      try {
        reqRef.current("walk");
      } catch { /* noop */ }
      const dx = rand(-160, 160);
      const dy = rand(-40, 40);
      if (dx !== 0) setFacing(dx >= 0 ? 1 : -1);

      // Try moving the native window (Tauri). Fallback: CSS offset.
      let movedNative = false;
      try {
        const w = getCurrentWindow();
        const pos = await w.outerPosition();
        const scale = await w.scaleFactor().catch(() => 1);
        const steps = 24;
        const stepX = dx / steps;
        const stepY = dy / steps;
        // Clamp to screen
        const sw = window.screen.availWidth || 1920;
        const sh = window.screen.availHeight || 1080;
        for (let i = 1; i <= steps; i++) {
          if (cancelled) break;
          const nx = Math.min(Math.max(pos.x + (stepX * i) / scale, 0), Math.max(sw - 240, 0));
          const ny = Math.min(Math.max(pos.y + (stepY * i) / scale, 0), Math.max(sh - 240, 0));
          await w.setPosition({ x: Math.round(nx), y: Math.round(ny) } as never);
          movedNative = true;
          await new Promise((r) => setTimeout(r, 40));
        }
      } catch {
        // web preview: animate CSS offset
        setOffset((o) => ({ x: Math.max(-120, Math.min(120, o.x + dx * 0.4)), y: 0 }));
      }
      void movedNative;
      if (!cancelled) {
        try { reqRef.current("idle"); } catch { /* noop */ }
      }
      busy.current = false;
      schedule();
    };

    schedule();
    return () => { cancelled = true; clearTimeout(idleTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reducedMotion, paused]);

  return { offset, facing };
}
