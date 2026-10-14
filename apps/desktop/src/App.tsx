import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { PetCanvas } from "./components/PetCanvas/PetCanvas";
import { MainPanel, schedulerTick, type PanelTab } from "./components/MainPanel";
import { Icon, type IconName } from "./components/Icon";
import { PetContextMenu, type MenuAction } from "./features/pet/PetContextMenu";
import { useWander } from "./features/pet/useWander";
import {
  TRANSIENT_STATES, TRANSIENT_TIMEOUT_MS, canTransitionTo, type PetState,
} from "./features/pet/petStateMachine";
import { loadSettings, saveSettings, store, type DeskSettings, type WanderPace, type WanderDirection } from "./lib/store";
import { pullBackendSettings, pushBackendSettings } from "./lib/settingsSync";
import { onToast, toast, type Toast } from "./lib/notify";
import { speak, stopSpeech } from "./lib/tts";
import {
  alertKey, formatCountdown, getCachedPrayerDay, getInstantPrayerDay, getNextPrayer, getPrayerDay,
  getUpcomingReminder, markFired, playAdzanBeep, timeOf, toYMD, wasFired,
  type PrayerDay,
} from "./features/prayer/prayer";
import { isQuietHours } from "./lib/time";
import { petWindowLogicalSize, measurePetContentHeight } from "./lib/petWindow";
import { keepWindowOnScreen } from "./lib/windowFit";

/**
 * DeskPet shell: pet interaktif (drag kiri, klik = react, klik kanan = menu,
 * jalan otomatis) + panel lokal (asisten/pengingat/tugas/catatan/timer/dll).
 * Local-first, tanpa telemetri.
 */
const TOAST_ICON: Record<Toast["kind"], IconName> = {
  reminder: "bell", success: "checkCircle", error: "xCircle", info: "info",
};
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
  const [prayerDay, setPrayerDay] = useState<PrayerDay | null>(null);
  const [alertBubble, setAlertBubble] = useState<{ title: string; body: string; icon: IconName } | null>(null);
  const [prayerTick, setPrayerTick] = useState(0); // re-render countdown tiap detik
  const [alertEnlarged, setAlertEnlarged] = useState(false); // pesan penting -> pet 200%
  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  const dragInfo = useRef<{ sx: number; sy: number; dragging: boolean } | null>(null);
  const petStateRef = useRef(petState);
  petStateRef.current = petState;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  // Backend sync gate: jangan push sebelum pull boot selesai,
  // agar default lokal tidak menimpa salinan tahan lama di backend.
  const backendSynced = useRef(false);

  // Safety flush: tulis ulang settings saat halaman ditutup/disembunyikan.
  // (Semua perubahan normalnya sudah tersimpan sync, ini jaring pengaman.)
  useEffect(() => {
    const flush = () => {
      try { saveSettings(settingsRef.current); } catch { /* noop */ }
      pushBackendSettings(settingsRef.current);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const requestState = useCallback(async (next: PetState) => {
    const prev = petStateRef.current;
    if (!canTransitionTo(prev, next)) return;
    petStateRef.current = next;
    setPetState(next);
    try { await invoke("pet_set_state", { next }); } catch { /* preview */ }
  }, []);

  // Init from Rust + settings.
  // Salinan tahan lama backend (file app-data) menang atas cache lokal bila ada.
  useEffect(() => {
    let cancelled = false;
    invoke<PetState>("pet_get_state").then((s) => { if (!cancelled) { petStateRef.current = s; setPetState(s); } })
      .catch(() => { if (!cancelled) setBackend("web-preview"); });
    invoke<boolean>("pet_is_visible").then((v) => { if (!cancelled) setVisible(v); }).catch(() => {});
    pullBackendSettings().then((remote) => {
      if (cancelled) return;
      if (remote) {
        saveSettings(remote);
        setSettings(remote);
      }
      backendSynced.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  // Apply always-on-top + simpan settings (lokal selalu, backend setelah sync boot).
  useEffect(() => {
    try { void getCurrentWindow().setAlwaysOnTop(settings.alwaysOnTop); } catch { /* preview */ }
    saveSettings(settings);
    if (backendSynced.current) pushBackendSettings(settings);
  }, [settings]);

  // Transient auto-return
  useEffect(() => {
    if (!TRANSIENT_STATES.includes(petState)) return;
    const t = setTimeout(() => void requestState("idle"), TRANSIENT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [petState, requestState]);

  // Konfirmasi pesan: kecilkan pet ke ukuran semula + tutup bubble/toast + idle.
  const confirmAlert = useCallback(() => {
    setAlertEnlarged(false);
    setAlertBubble(null);
    setToasts((xs) => xs.filter((x) => x.kind !== "reminder"));
    void requestState("idle");
  }, [requestState]);

  // Toasts (in-app saja, tanpa izin OS). Pesan penting -> pet membesar 200%.
  // Toast reminder PENTING: tidak auto-hilang (menunggu klik konfirmasi),
  // karena kalau toast hilang duluan user tidak punya apa-apa untuk diklik
  // selain Esc. Toast biasa tetap auto-hilang 4,2 dtk.
  useEffect(() => onToast((t) => {
    setToasts((xs) => [t, ...xs].slice(0, 4));
    if (t.kind === "reminder") {
      setAlertEnlarged(true);
      void requestState("reminder");
      return;
    }
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== t.id)), 4200);
  }), [requestState]);

  // Window size: compact pet vs expanded panel vs context menu
  // (the 230px context menu cannot fit in the 220px pet window).
  // Window DIPELUK ke sprite (tight, bukan 220px longgar): area transparan
  // yang ikut memblokir klik window di belakang jadi minimal dan ikut
  // mengecil/membesar bersama petScale. Sprite 128px + breathing 32px
  // (16/sisi, ruang untuk bob/shadow/outline) -> 160px @scale 1.
  // Pill/bubble/timer tetap melebarkan window sesuai kebutuhan kontennya.
  const petScale = settings.petScale ?? 1;
  const effectiveScale = alertEnlarged ? 2 : petScale;
  const reserveAlert = alertBubble !== null;
  const reserveMini = !reserveAlert && settings.prayerEnabled && settings.prayerMiniEnabled !== false && prayerDay !== null && panel === null;
  const reserveTimer = timerLeft !== null && settings.timerBadgeEnabled !== false;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const w = getCurrentWindow();
        let finalW = 0;
        let finalH = 0;
        if (panel) {
          finalW = 400;
          finalH = 620 + (reserveAlert ? 190 : 0);
          await w.setSize(new LogicalSize(finalW, finalH));
        } else if (menu) {
          finalW = 400;
          finalH = 560 + (reserveAlert ? 190 : 0);
          await w.setSize(new LogicalSize(finalW, finalH));
        } else {
          const guess = petWindowLogicalSize(effectiveScale, {
            alert: reserveAlert, mini: reserveMini, timer: reserveTimer,
          });
          // Lebar final langsung dari tebakan (tetap, anti-flicker teks
          // countdown tiap detik); tinggi dikoreksi dari hasil ukur DOM agar
          // bubble sepanjang apa pun tidak kepotong.
          finalW = guess.width;
          finalH = guess.height;
          await w.setSize(new LogicalSize(finalW, finalH));
          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
          if (cancelled) return;
          const height = measurePetContentHeight(effectiveScale);
          if (Math.abs(height - guess.height) > 2) {
            finalH = height;
            await w.setSize(new LogicalSize(finalW, finalH));
          }
        }
        // Window membesar dengan anchor kiri-atas: kalau pet di pojok
        // kanan/bawah, window meluber keluar layar dan menu/panel kepotong.
        // Geser window secukupnya agar muat di work-area (kanan->kiri,
        // bawah->atas, dan sebaliknya).
        if (!cancelled) await keepWindowOnScreen(finalW, finalH);
      } catch { /* web preview uses CSS */ }
    })();
    return () => { cancelled = true; };
  }, [panel, menu, effectiveScale, reserveAlert, reserveMini, reserveTimer, alertBubble]);

  // Scheduler tick (PRD §5.2: DB = source of truth, no duplicate, missed handling)
  useEffect(() => {
    const tick = () => {
      const fired = schedulerTick({ settings, onFired: () => {} });
      for (const r of fired) {
        void requestState("reminder");
        setAlertEnlarged(true); // karakter membesar sampai dikonfirmasi
        // Sama seperti sholat: bubble besar di ATAS pet (tidak menutupi kucing)
        // + membesar 200% + mengecil saat dikonfirmasi (klik pet/bubble/toast/Esc).
        setAlertBubble({ title: r.title, body: "Pengingat jatuh tempo — klik untuk konfirmasi.", icon: "bell" });
        const autoSpeak = store.automations.all().find((a) => a.id === "auto_speak")?.enabled ?? true;
        toast(r.title, "Pengingat jatuh tempo", "reminder");
        if (autoSpeak && !settings.speechMuted) speak(`Pengingat: ${r.title}`, { muted: settings.speechMuted });
        else if (!settings.soundMuted) { try { new AudioContext().close(); } catch { /* no beep impl */ } }
        bump();
        setTimeout(() => {
          setAlertBubble((b) => (b?.title === r.title ? null : b));
          setAlertEnlarged(false);
        }, 60_000);
      }
      // Weekday morning summary (08:59–09:01 window, once/day)
      const now = new Date();
      if (now.getHours() === 9 && now.getMinutes() === 0) {
        const auto = store.automations.all().find((a) => a.id === "auto_morning");
        const today = now.toDateString();
        if (auto?.enabled && auto.lastRunAt && new Date(auto.lastRunAt).toDateString() !== today) {
          const dueToday = store.todos.all().filter((t) => t.status !== "completed").length;
          // Sama seperti pengingat lain: bubble di atas pet + membesar + konfirmasi.
          setAlertBubble({ title: "Ringkasan pagi", body: `${dueToday} tugas terbuka — klik untuk konfirmasi.`, icon: "sun" });
          setAlertEnlarged(true);
          void requestState("reminder");
          toast("Ringkasan pagi", `${dueToday} tugas terbuka. Dobel-klik pet, lalu buka tab Tugas.`, "reminder");
          setTimeout(() => {
            setAlertBubble((b) => (b?.title === "Ringkasan pagi" ? null : b));
            setAlertEnlarged(false);
          }, 60_000);
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

  // Prayer ticker: cache-sync + alert masuk waktu & H-X menit (bubble di atas pet + adzan).
  // Local-first: pakai cache dulu, network best-effort 1x per kota per hari.
  useEffect(() => {
    if (!settings.prayerEnabled) return;
    const cityId = settings.prayerCityId ?? "1301";
    const cityName = settings.prayerCityName ?? "KOTA JAKARTA";
    let cancelled = false;

    const check = async () => {
      if (cancelled) return;
      const now = new Date();
      const ymd = toYMD(now);
      // 0) Paint instan dari cache (lokal, lalu file tahan lama) agar pill
      //    langsung tampil saat boot — tanpa menunggu network.
      let day = getCachedPrayerDay(cityId, now);
      if (!day || day.date !== ymd) {
        const instant = await getInstantPrayerDay(cityId, now);
        if (cancelled) return;
        if (instant && instant.date === ymd) {
          day = instant;
          setPrayerDay(instant);
        }
      }
      // 1) Refresh network hanya bila belum ada data segar (jadwal statis
      //    per hari — tidak perlu fetch tiap 15 dtk).
      if (!day || day.date !== ymd) {
        const live = await getPrayerDay(cityId, cityName, now);
        if (cancelled) return;
        if (live) {
          day = live;
          setPrayerDay(live);
        }
      }
      if (!day) return;

      // 1) Tepat masuk waktu (toleransi: 0–90 dtk setelah jadwal, cegah duplikat per hari)
      for (const name of ["Subuh", "Dzuhur", "Ashar", "Maghrib", "Isya"] as const) {
        const at = new Date(now);
        const [hh, mm] = timeOf(day, name).split(":").map(Number);
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
        at.setHours(hh, mm, 0, 0);
        const diff = now.getTime() - at.getTime();
        const key = alertKey(ymd, name);
        if (diff >= 0 && diff <= 90_000 && !wasFired(key)) {
          markFired(key);
          const quiet = settings.quietHoursEnabled && isQuietHours(now, settings.quietStart, settings.quietEnd);
          if (settings.prayerBubbleEnabled !== false) {
            setAlertBubble({ title: `Masuk waktu ${name} · ${timeOf(day, name)}`, body: "Yuk sholat dulu — klik untuk konfirmasi.", icon: "moonStar" });
          }
          setAlertEnlarged(true);
          void requestState("reminder");
          toast(`${name} ${timeOf(day, name)}`, `${cityName} · saatnya sholat`, "reminder");
          if (settings.prayerAdzanEnabled && !quiet) {
            if (!settings.soundMuted) playAdzanBeep(3);
            if (!settings.speechMuted) speak(`Sudah masuk waktu sholat ${name}.`, { muted: false });
          }
          bump();
          setTimeout(() => {
            setAlertBubble((b) => (b?.title.includes(name) ? null : b));
            setAlertEnlarged(false);
          }, 60_000);
          return;
        }
      }

      // 2) Pengingat H-X menit
      const mins = settings.prayerReminderMins ?? 10;
      if (mins > 0) {
        const up = getUpcomingReminder(day, now, mins);
        if (up) {
          const key = alertKey(ymd, `before-${up.name}`);
          // Hanya bunyi sekali per 5 menit agar tidak spam tiap tick.
          const slot = `${key}@${Math.floor(now.getTime() / 300_000)}`;
          if (!wasFired(slot)) {
            markFired(slot);
            if (settings.prayerBubbleEnabled !== false) {
              setAlertBubble({ title: `${up.name} ${timeOf(day, up.name)} · ${Math.ceil(up.diffMs / 60000)} mnt lagi`, body: "Siap-siap yuk — klik untuk konfirmasi.", icon: "moonStar" });
              setAlertEnlarged(true);
              setTimeout(() => {
                setAlertBubble((b) => (b?.title.includes(up.name) ? null : b));
                setAlertEnlarged(false);
              }, 45_000);
            }
            toast(`${up.name} sebentar lagi`, `${timeOf(day, up.name)} · ${cityName}`, "info");
          }
        }
      }
    };

    // Instant cache paint (hanya jadwal hari ini — jadwal basi tidak dipaint),
    // lalu cek periodik (check() juga mengecat dari file tahan lama).
    const today = toYMD(new Date());
    const cached = getCachedPrayerDay(cityId, new Date());
    if (cached && cached.date === today) setPrayerDay(cached);
    void check();
    const fast = setInterval(() => setPrayerTick((t) => t + 1), 1000);
    const slow = setInterval(() => void check(), 15_000);
    return () => { cancelled = true; clearInterval(fast); clearInterval(slow); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.prayerEnabled, settings.prayerCityId, settings.prayerCityName, settings.prayerAdzanEnabled, settings.prayerBubbleEnabled, settings.prayerReminderMins, settings.quietHoursEnabled, settings.quietStart, settings.quietEnd, settings.soundMuted, settings.speechMuted]);
  // Timer countdown
  const timerEnd = useRef<number | null>(null);
  const timerStart = useCallback((secs: number, label = "Fokus") => {
    timerEnd.current = Date.now() + secs * 1000;
    setTimerLeft(secs); setTimerLabel(label);
    void requestState("attention");
    toast(`${label} dimulai`, `${Math.round(secs / 60)} menit`, "info");
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
        // Opsi user: selesai tanpa alert = timer diam-diam selesai (tetap refresh panel).
        if (settingsRef.current.timerDoneAlertEnabled !== false) {
          void requestState("react");
          setAlertEnlarged(true); // karakter membesar sampai dikonfirmasi
          // Sama seperti sholat/pengingat: bubble besar di ATAS pet.
          setAlertBubble({ title: `${timerLabel} selesai`, body: "Waktunya istirahat / lanjut — klik untuk konfirmasi.", icon: "timer" });
          toast(`${timerLabel} selesai`, "Waktunya istirahat / lanjut.", "reminder");
          if (!settings.speechMuted) speak("Timer selesai.", { muted: settings.speechMuted });
          setTimeout(() => {
            setAlertBubble((b) => (b?.title === `${timerLabel} selesai` ? null : b));
            setAlertEnlarged(false);
          }, 60_000);
        }
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
    // Klik pet = konfirmasi pesan penting (kecilkan kembali). Ini yang paling
    // intuitif: user mengklik karakter/toast/bubble/Esc, semuanya mengecilkan.
    if (alertEnlarged) { confirmAlert(); return; }
    if (wasDragging) void requestState("idle");
    else void requestState("react"); // plain click = happy react
  }, [requestState, alertEnlarged, confirmAlert]);
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
      case "timer-5": timerStart(5 * 60, "Fokus"); break;
      case "timer-15": timerStart(15 * 60, "Fokus"); break;
      case "timer-25": timerStart(25 * 60, "Fokus"); break;
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
        toast("Kecepatan jalan diubah", names[next], "info");
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
        toast("Arah jalan diubah", names[next], "info");
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
  }, [requestState, setVisibleBoth, timerStart, settings.wanderPace, settings.wanderDirection]);

  // Keyboard: Ctrl/Cmd+Shift+D hide/show, Esc confirms alert, else closes menu/panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        void setVisibleBoth(!visible);
      } else if (e.key === "Escape") {
        if (alertEnlarged) confirmAlert();
        else if (menu) setMenu(null);
        else if (panel) setPanel(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, menu, panel, setVisibleBoth, alertEnlarged, confirmAlert]);

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
  const onDoubleClick = useCallback(() => {
    if (alertEnlarged) confirmAlert();
    openTab("assistant");
  }, [openTab, alertEnlarged, confirmAlert]);

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

  // Countdown mini untuk bubble (re-render tiap detik via prayerTick).
  void prayerTick;
  const miniNext = settings.prayerEnabled && settings.prayerMiniEnabled !== false && prayerDay && !panel
    ? getNextPrayer(prayerDay, new Date())
    : null;

  return (
    <div
      className={`dp-root${panel ? " with-panel" : ""}${(alertBubble || miniNext) && !panel ? " has-bubble" : ""}${reserveTimer && !panel ? " has-status" : ""}`}
      onContextMenu={onCtxMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Popup alert di atas karakter (sholat/alarm/pengingat).
          Klik pet / bubble / tombol Mengerti = konfirmasi -> pet kembali ke ukuran semula. */}
      {alertBubble && (
        <div className="dp-speech" data-testid="alert-bubble" role="alert"
          onClick={confirmAlert} title="Klik untuk konfirmasi">
          <b><span className="dp-line"><Icon name={alertBubble.icon} size={14} /> {alertBubble.title}</span></b>
          <div>{alertBubble.body}</div>
          <button className="dp-btn primary sm" onClick={(e) => { e.stopPropagation(); confirmAlert(); }}>
            <Icon name="check" size={13} /> Mengerti
          </button>
        </div>
      )}
      {!alertBubble && miniNext && (
        <button className="dp-bubble-mini" data-testid="prayer-mini"
          onClick={() => openTab("prayer")}
          title="Klik untuk buka jadwal sholat">
          <span className="dp-line"><Icon name="moonStar" size={12} /> {miniNext.name} {timeOf(prayerDay!, miniNext.name)} · {formatCountdown(miniNext.at.getTime() - Date.now())}</span>
        </button>
      )}
      <div
        className={`dp-pet-wrap${alertEnlarged ? " dp-alert" : ""}`}
        style={backend === "web-preview"
          ? { transform: `translate(${offset.x}px, ${offset.y}px) scale(${facing * effectiveScale}, ${effectiveScale})` }
          : { transform: `scale(${facing * effectiveScale}, ${effectiveScale})` }}
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
        data-alert={alertEnlarged ? "enlarged" : "normal"}
        title={alertEnlarged
          ? "Ada pesan penting! Klik pet / bubble / toast / tekan Esc untuk konfirmasi."
          : "Drag kiri untuk pindah · klik = sapa · klik kanan = menu · dobel-klik = asisten"}
      >
        <PetCanvas
          state={petState}
          reducedMotion={settings.reducedMotion}
          characterId={settings.characterId}
          speed={walkSpeed}
          onTap={() => {}}
        />
      </div>

      {/* Timer badge hanya jika ada timer aktif + user mengizinkan */}
      {timerLeft !== null && settings.timerBadgeEnabled !== false && (
        <div className="dp-status" data-testid="status" title="Timer aktif">
          <span className="dp-line"><Icon name="timer" size={12} /> {Math.floor(timerLeft / 60)}:{String(timerLeft % 60).padStart(2, "0")}</span>
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
          <div key={t.id} className={`dp-toast ${t.kind}${t.kind === "reminder" ? " clickable" : ""}`}
            role={t.kind === "reminder" ? "alert" : "status"}
            onClick={() => {
              if (t.kind === "reminder") confirmAlert();
              setToasts((xs) => xs.filter((x) => x.id !== t.id));
            }}
            title={t.kind === "reminder" ? "Klik untuk konfirmasi (pet kembali normal)" : "Klik untuk tutup"}>
            <div className="dp-toast-main">
              <span className="dp-toast-icon"><Icon name={TOAST_ICON[t.kind]} size={14} /></span>
              <div><b>{t.title}</b>{t.body ? <div>{t.body}</div> : null}
                {t.kind === "reminder" && <div className="dp-toast-hint"><Icon name="check" size={11} /> klik untuk konfirmasi</div>}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Re-export for assistant execute path typing
export type { PanelTab };
