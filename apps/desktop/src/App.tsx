import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { PetCanvas } from "./components/PetCanvas/PetCanvas";
import { MainPanel, schedulerTick, type PanelTab } from "./components/MainPanel";
import { PetContextMenu, type MenuAction } from "./features/pet/PetContextMenu";
import { useWander } from "./features/pet/useWander";
import {
  TRANSIENT_STATES, TRANSIENT_TIMEOUT_MS, canTransitionTo, type PetState,
} from "./features/pet/petStateMachine";
import { loadSettings, saveSettings, store, type DeskSettings, type WanderPace, type WanderDirection } from "./lib/store";
import { onToast, toast, type Toast } from "./lib/notify";
import { speak, stopSpeech } from "./lib/tts";

/**
 * DeskPet shell: pet interaktif (drag kiri, klik = react, klik kanan = menu,
 * jalan otomatis) + panel lokal (asisten/pengingat/tugas/catatan/timer/dll).
 * Local-first, tanpa telemetri.
 */
export default function App() {
  const [petState, setPetState] = useState<PetState>("idle");
  const [visible, setVisible] = useState(true);
  const [settings, setSettings] = useState<DeskSettings>(() => loadSettings());
  const [backend, setBackend] = useState<string>("tauri");
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [panel, setPanel] = useState<null | PanelTab>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [timerLeft, setTimerLeft] = useState<number | null>(null);
  const [timerLabel, setTimerLabel] = useState("Fokus");
  const [hovered, setHovered] = useState(false);
  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  const dragInfo = useRef<{ sx: number; sy: number; dragging: boolean } | null>(null);
  const petStateRef = useRef(petState);
  petStateRef.current = petState;

  const requestState = useCallback(async (next: PetState) => {
    const prev = petStateRef.current;
    if (!canTransitionTo(prev, next)) return;
    petStateRef.current = next;
    setPetState(next);
    try { await invoke("pet_set_state", { next }); } catch { /* preview */ }
  }, []);

  // Init from Rust + settings
  useEffect(() => {
    let cancelled = false;
    invoke<PetState>("pet_get_state").then((s) => { if (!cancelled) { petStateRef.current = s; setPetState(s); } })
      .catch(() => { if (!cancelled) setBackend("web-preview"); });
    invoke<boolean>("pet_is_visible").then((v) => { if (!cancelled) setVisible(v); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Apply always-on-top
  useEffect(() => {
    try { void getCurrentWindow().setAlwaysOnTop(settings.alwaysOnTop); } catch { /* preview */ }
    saveSettings(settings);
  }, [settings]);

  // Transient auto-return
  useEffect(() => {
    if (!TRANSIENT_STATES.includes(petState)) return;
    const t = setTimeout(() => void requestState("idle"), TRANSIENT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [petState, requestState]);

  // Toasts
  useEffect(() => onToast((t) => {
    setToasts((xs) => [t, ...xs].slice(0, 4));
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== t.id)), 4200);
  }), []);

  // Window size: compact pet vs expanded panel vs context menu
  // (the 230px context menu cannot fit in the 220px pet window).
  // Pet window grows with petScale so a 2x pet isn't clipped.
  const petScale = settings.petScale ?? 1;
  useEffect(() => {
    (async () => {
      try {
        const w = getCurrentWindow();
        if (panel) await w.setSize(new LogicalSize(400, 620));
        else if (menu) await w.setSize(new LogicalSize(400, 560));
        else {
          const side = Math.round(220 * petScale);
          await w.setSize(new LogicalSize(side, side));
        }
      } catch { /* web preview uses CSS */ }
    })();
  }, [panel, menu, petScale]);

  // Scheduler tick (PRD §5.2: DB = source of truth, no duplicate, missed handling)
  useEffect(() => {
    const tick = () => {
      const fired = schedulerTick({ settings, onFired: () => {} });
      for (const r of fired) {
        void requestState("reminder");
        const autoSpeak = store.automations.all().find((a) => a.id === "auto_speak")?.enabled ?? true;
        toast(`⏰ ${r.title}`, "Pengingat jatuh tempo", "reminder");
        if (autoSpeak && !settings.speechMuted) speak(`Pengingat: ${r.title}`, { muted: settings.speechMuted });
        else if (!settings.soundMuted) { try { new AudioContext().close(); } catch { /* no beep impl */ } }
        bump();
      }
      // Weekday morning summary (08:59–09:01 window, once/day)
      const now = new Date();
      if (now.getHours() === 9 && now.getMinutes() === 0) {
        const auto = store.automations.all().find((a) => a.id === "auto_morning");
        const today = now.toDateString();
        if (auto?.enabled && auto.lastRunAt && new Date(auto.lastRunAt).toDateString() !== today) {
          const dueToday = store.todos.all().filter((t) => t.status !== "completed").length;
          toast("☀️ Ringkasan pagi", `${dueToday} tugas terbuka. Klik kanan → Tugas.`, "info");
          auto.lastRunAt = now.toISOString();
          store.automations.save(store.automations.all().map((a) => (a.id === auto.id ? auto : a)));
        }
      }
      // Timer countdown handled separately
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [settings, bump, requestState]);

  // Timer countdown
  const timerEnd = useRef<number | null>(null);
  const timerStart = useCallback((secs: number, label = "Fokus") => {
    timerEnd.current = Date.now() + secs * 1000;
    setTimerLeft(secs); setTimerLabel(label);
    void requestState("attention");
    toast(`⏱️ ${label} dimulai`, `${Math.round(secs / 60)} menit`, "info");
  }, [requestState]);
  useEffect(() => {
    if (timerLeft === null) return;
    const id = setInterval(() => {
      if (!timerEnd.current) return;
      const left = Math.max(0, Math.round((timerEnd.current - Date.now()) / 1000));
      setTimerLeft(left);
      if (left <= 0) {
        clearInterval(id);
        timerEnd.current = null;
        setTimerLeft(null);
        void requestState("react");
        toast(`⏱️ ${timerLabel} selesai`, "Waktunya istirahat / lanjut.", "reminder");
        if (!settings.speechMuted) speak("Timer selesai.", { muted: settings.speechMuted });
        bump();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [timerLeft !== null]); // eslint-disable-line

  const setVisibleBoth = useCallback(async (v: boolean) => {
    setVisible(v);
    try {
      await invoke("pet_set_visible", { visible: v });
      const w = getCurrentWindow();
      if (v) await w.show(); else await w.hide();
    } catch { /* preview */ }
  }, []);

  // Left-drag with click-vs-drag threshold (fixes accidental UI clicks).
  // NOTE: Tauri `startDragging()` hands the gesture to the OS, so `mouseup`
  // on the pet element often never fires. We therefore listen on `window`
  // and always reset `dragged -> idle` on release — no extra click needed.
  const endDrag = useCallback((wasDragging: boolean) => {
    if (wasDragging) void requestState("idle");
    else void requestState("react"); // plain click = happy react
  }, [requestState]);
  const onPetMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click initiates dragging, right click is for menu
    dragInfo.current = { sx: e.clientX, sy: e.clientY, dragging: false };
    void requestState("dragged");
  }, [requestState]);
  const onPetMouseMove = useCallback((e: React.MouseEvent) => {
    const d = dragInfo.current;
    if (!d || d.dragging) return;
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 5) {
      d.dragging = true;
      void requestState("dragged");
      try { void getCurrentWindow().startDragging(); } catch { /* preview */ }
    }
  }, [requestState]);
  const onPetMouseUp = useCallback(() => {
    const d = dragInfo.current;
    dragInfo.current = null;
    if (!d) return;
    endDrag(d.dragging);
  }, [endDrag]);

  // Backup: OS-level drag release (covers startDragging hijack + cursor
  // leaving the pet element mid-drag). Guarantees expression resets to idle.
  useEffect(() => {
    const onUp = () => {
      const d = dragInfo.current;
      if (!d) return;
      dragInfo.current = null;
      endDrag(d.dragging);
    };
    const onBlur = () => {
      const d = dragInfo.current;
      if (d?.dragging) {
        dragInfo.current = null;
        void requestState("idle");
      }
    };
    window.addEventListener("mouseup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [endDrag, requestState]);

  const openTab = useCallback((t: PanelTab) => {
    setMenu(null);
    setPanel(t);
  }, []);

  const onMenuPick = useCallback(async (a: MenuAction) => {
    setMenu(null);
    const clampScale = (v: number) => Math.min(2, Math.max(0.5, Math.round(v * 10) / 10));
    switch (a) {
      case "open-assistant": case "open-reminders": case "open-tasks": case "open-notes":
      case "open-timer": case "open-calendar": case "open-automations": case "open-settings": {
        const map: Record<string, PanelTab> = {
          "open-assistant": "assistant", "open-reminders": "reminders", "open-tasks": "tasks",
          "open-notes": "notes", "open-timer": "timer", "open-calendar": "calendar",
          "open-automations": "auto", "open-settings": "settings",
        };
        openTab(map[a]);
        break;
      }
      case "toggle-wander": setSettings((s) => ({ ...s, wanderEnabled: !s.wanderEnabled })); break;
      case "cycle-wander-pace": {
        const paces: WanderPace[] = ["random", "slow", "fast", "normal"];
        const cur = settings.wanderPace ?? "random";
        const next = paces[(paces.indexOf(cur) + 1) % paces.length];
        setSettings((s) => ({ ...s, wanderPace: next }));
        const names: Record<WanderPace, string> = {
          random: "Acak (Lari / Santai)",
          slow: "Santai / Pelan",
          fast: "Lari (Sprint Cepat)",
          normal: "Normal",
        };
        toast("⚡ Kecepatan jalan diubah", names[next], "info");
        break;
      }
      case "cycle-wander-dir": {
        const dirs: WanderDirection[] = ["random", "horizontal", "vertical"];
        const cur = settings.wanderDirection ?? "random";
        const next = dirs[(dirs.indexOf(cur) + 1) % dirs.length];
        setSettings((s) => ({ ...s, wanderDirection: next }));
        const names: Record<WanderDirection, string> = {
          random: "Acak (Semua Arah)",
          horizontal: "Kiri – Kanan (Patroli)",
          vertical: "Atas – Bawah",
        };
        toast("↔️ Arah jalan diubah", names[next], "info");
        break;
      }
      case "toggle-top": setSettings((s) => ({ ...s, alwaysOnTop: !s.alwaysOnTop })); break;
      case "toggle-motion": setSettings((s) => ({ ...s, reducedMotion: !s.reducedMotion })); break;
      case "scale-up": setSettings((s) => ({ ...s, petScale: clampScale((s.petScale ?? 1) + 0.1) })); break;
      case "scale-down": setSettings((s) => ({ ...s, petScale: clampScale((s.petScale ?? 1) - 0.1) })); break;
      case "scale-reset": setSettings((s) => ({ ...s, petScale: 1 })); break;
      case "sleep": stopSpeech(); void requestState("sleep"); break;
      case "wake": void requestState("idle"); break;
      case "hide": void setVisibleBoth(false); break;
      case "quit":
        try { await invoke("app_quit"); }
        catch { window.close(); }
        break;
    }
  }, [openTab, requestState, setVisibleBoth, settings.wanderPace, settings.wanderDirection]);

  // Keyboard: Ctrl/Cmd+Shift+D hide/show, Esc closes menu/panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        void setVisibleBoth(!visible);
      } else if (e.key === "Escape") {
        if (menu) setMenu(null);
        else if (panel) setPanel(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, menu, panel, setVisibleBoth]);

  // Stop pet in its tracks when cursor focuses/hovers on the pet window
  useEffect(() => {
    const onEnter = () => setHovered(true);
    const onLeave = (e: MouseEvent) => {
      if (!e.relatedTarget) setHovered(false);
    };
    const onBlur = () => setHovered(false);
    window.addEventListener("mouseenter", onEnter);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("mouseover", onEnter);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("mouseenter", onEnter);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mouseover", onEnter);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const wanderPaused = menu !== null || panel !== null || petState === "dragged" || hovered;
  const { offset, facing, walkSpeed } = useWander({
    enabled: settings.wanderEnabled,
    wanderPace: settings.wanderPace ?? "random",
    wanderDirection: settings.wanderDirection ?? "random",
    petState,
    reducedMotion: settings.reducedMotion,
    paused: wanderPaused,
    requestState,
  });

  // Quick NL from hidden? double-click opens assistant
  const onDoubleClick = useCallback(() => openTab("assistant"), [openTab]);

  if (!visible) {
    return (
      <div className="dp-root dp-hidden">
        <button className="dp-btn" onClick={() => void setVisibleBoth(true)}>Tampilkan DeskPet</button>
      </div>
    );
  }

  // Backup layer: block any native/WebView default menu document-wide
  // (the React handler above opens our menu; this only suppresses defaults).
  useEffect(() => {
    const onNative = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && typeof el.closest === "function" && el.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", onNative);
    return () => document.removeEventListener("contextmenu", onNative);
  }, []);

  // Right-click anywhere in the pet window opens our menu — except on editable
  // fields inside the panel (keep the native copy/paste menu there).
  const onCtxMenu = useCallback((e: React.MouseEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && typeof el.closest === "function" && el.closest("input, textarea, select, [contenteditable='true']")) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <div
      className={`dp-root${panel ? " with-panel" : ""}`}
      onContextMenu={onCtxMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="dp-pet-wrap"
        style={backend === "web-preview"
          ? { transform: `translate(${offset.x}px, ${offset.y}px) scale(${facing * petScale}, ${petScale})` }
          : { transform: `scale(${facing * petScale}, ${petScale})` }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseDown={onPetMouseDown}
        onMouseMove={(e) => {
          if (!hovered) setHovered(true);
          onPetMouseMove(e);
        }}
        onMouseUp={onPetMouseUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={onCtxMenu}
        data-testid="drag-region"
        title="Drag kiri untuk pindah · klik = sapa · klik kanan = menu · dobel-klik = asisten"
      >
        <PetCanvas
          state={petState}
          reducedMotion={settings.reducedMotion}
          characterId={settings.characterId}
          speed={walkSpeed}
          onTap={() => {}}
        />
      </div>

      {/* Timer badge hanya jika ada timer aktif */}
      {timerLeft !== null && (
        <div className="dp-status" data-testid="status" title="Timer aktif">
          ⏱ {Math.floor(timerLeft / 60)}:{String(timerLeft % 60).padStart(2, "0")}
        </div>
      )}

      {menu && (
        <PetContextMenu
          x={menu.x} y={menu.y}
          wanderEnabled={settings.wanderEnabled}
          wanderPace={settings.wanderPace ?? "random"}
          wanderDirection={settings.wanderDirection ?? "random"}
          alwaysOnTop={settings.alwaysOnTop}
          reducedMotion={settings.reducedMotion} sleeping={petState === "sleep"}
          petScale={petScale}
          onPick={(a) => void onMenuPick(a)} onClose={() => setMenu(null)}
        />
      )}

      {panel && (
        <MainPanel tab={panel} setTab={setPanel} onClose={() => setPanel(null)}
          settings={settings} setSettings={setSettings}
          refreshKey={refreshKey} bump={bump} timerStart={timerStart} timerLeft={timerLeft} />
      )}

      <div className="dp-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`dp-toast ${t.kind}`}>
            <b>{t.title}</b>{t.body ? <div>{t.body}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// Re-export for assistant execute path typing
export type { PanelTab };
