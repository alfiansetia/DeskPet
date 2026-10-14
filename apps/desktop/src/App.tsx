import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PetCanvas } from "./components/PetCanvas/PetCanvas";
import {
  TRANSIENT_STATES,
  TRANSIENT_TIMEOUT_MS,
  canTransitionTo,
  type PetState,
} from "./features/pet/petStateMachine";
import { loadJSON, saveJSON } from "./lib/storage";

/**
 * P1 pet window: transparent, draggable, hide/show via button + tray +
 * keyboard (Ctrl/Cmd+Shift+D). No network, no telemetry, no sensitive actions.
 */
export default function App() {
  const [petState, setPetState] = useState<PetState>(() => loadJSON("deskpet:pet-state", "idle") as PetState);
  const [visible, setVisible] = useState(true);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  const [backend, setBackend] = useState<string>("tauri");

  // Sync initial state from Rust (authoritative) when running under Tauri.
  useEffect(() => {
    let cancelled = false;
    invoke<PetState>("pet_get_state")
      .then((s) => { if (!cancelled) setPetState(s); })
      .catch(() => { if (!cancelled) setBackend("web-preview"); });
    invoke<boolean>("pet_is_visible")
      .then((v) => { if (!cancelled) setVisible(v); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Transient states (react/speak/reminder/attention) auto-return to idle.
  useEffect(() => {
    if (!TRANSIENT_STATES.includes(petState)) return;
    const t = setTimeout(() => requestState("idle"), TRANSIENT_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petState]);

  const requestState = useCallback(
    async (next: PetState) => {
      setPetState((prev) => {
        if (!canTransitionTo(prev, next)) return prev;
        return next;
      });
      saveJSON("deskpet:pet-state", next);
      try {
        await invoke("pet_set_state", { next });
      } catch {
        // Web preview or validation reject: keep local optimistic state only if valid.
      }
    },
    [],
  );

  const setVisibleBoth = useCallback(async (v: boolean) => {
    setVisible(v);
    try {
      await invoke("pet_set_visible", { visible: v });
      const w = getCurrentWindow();
      if (v) await w.show(); else await w.hide();
    } catch {
      // Web preview: local toggle only.
    }
  }, []);

  // Drag handling: Tauri drag region does the move; we only flip animation state.
  const onDragStart = useCallback(() => {
    void requestState("dragged");
    try { void getCurrentWindow().startDragging(); } catch { /* preview */ }
  }, [requestState]);

  const onDragEnd = useCallback(() => {
    void requestState("idle");
  }, [requestState]);

  // Keyboard: Ctrl/Cmd+Shift+D toggles visibility (PRD §5.1 hide/show shortcut).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        void setVisibleBoth(!visible);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, setVisibleBoth]);

  const toggleTop = useCallback(async () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    try { await getCurrentWindow().setAlwaysOnTop(next); } catch { /* preview */ }
  }, [alwaysOnTop]);

  return (
    <div className="dp-root">
      <div
        className="dp-drag"
        onMouseDown={onDragStart}
        onMouseUp={onDragEnd}
        data-testid="drag-region"
        title="Drag to move DeskPet"
      >
        <PetCanvas
          state={petState}
          reducedMotion={reducedMotion}
          characterId="deskpet.cat.lavender"
          onTap={() => void requestState("react")}
        />
      </div>

      <div className="dp-menu dp-nodrag" role="toolbar" aria-label="DeskPet quick menu">
        <button type="button" onClick={() => void setVisibleBoth(!visible)} title="Hide/show (Ctrl+Shift+D)">
          {visible ? "Hide" : "Show"}
        </button>
        <button type="button" onClick={toggleTop} title="Toggle always-on-top">
          Top:{alwaysOnTop ? "on" : "off"}
        </button>
        <button type="button" onClick={() => setReducedMotion((v) => !v)} title="Toggle reduced motion">
          Motion:{reducedMotion ? "calm" : "full"}
        </button>
        <button type="button" onClick={() => void requestState("sleep")} title="Sleep">Zzz</button>
        <button type="button" onClick={() => void requestState("idle")} title="Wake">Wake</button>
      </div>

      <div className="dp-status dp-nodrag" data-testid="status">
        {petState} · {backend} · telemetry off · local-first
      </div>
    </div>
  );
}
