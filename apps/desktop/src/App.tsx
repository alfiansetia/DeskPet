import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { PetCanvas } from "./components/PetCanvas/PetCanvas";
import { MainPanel, schedulerTick, type PanelTab } from "./components/MainPanel";
import { Icon, type IconName } from "./components/Icon";
import { PetContextMenu, type MenuAction } from "./features/pet/PetContextMenu";
import { useWander, shouldCenterPet, sideOf, FLEE_COOLDOWN_MS, FLEE_HOVER_MS } from "./features/pet/useWander";
import { useIdleBehavior } from "./features/pet/useIdleBehavior";
import {
  TRANSIENT_STATES, TRANSIENT_TIMEOUT_MS, canTransitionTo, type PetState,
} from "./features/pet/petStateMachine";
import {
  ensureAutomationDefaults, loadCompanions, loadSettings, saveCompanions, saveSettings, store, uid, updateCompanion,
  type Companion, type DeskSettings, type WanderPace, type WanderDirection,
} from "./lib/store";
import { countOverdue, shouldFireTaskNudge } from "./lib/taskNudge";
import {
  MAIN_COMPANION_ID, companionIdFromWindowLabel, phaseDelayMsFor, resolvePresenterFor,
  slotPeriodJitterMsFor, slotPhaseFor, spawnCompanionWindow,
} from "./features/pet/companions";
import { pullBackendSettings, pushBackendSettings } from "./lib/settingsSync";
import { TIMER_KEY, clearSharedTimer, loadSharedTimer, saveSharedTimer, sharedTimerLeft } from "./lib/timerShared";
import { onToast, toast, type Toast } from "./lib/notify";
import { speak, stopSpeech } from "./lib/tts";
import {
  alertKey, formatCountdown, getCachedPrayerDay, getInstantPrayerDay, getNextPrayer, getPrayerDay,
  getUpcomingReminder, markFired, playAdzanBeep, timeOf, toYMD, wasFired,
  type PrayerDay,
} from "./features/prayer/prayer";
import { isQuietHours } from "./lib/time";
import { getCachedWeather, getWeather, weatherGroup, type WeatherNow } from "./features/weather/weather";
import { randomGreeting } from "./features/pet/greetings";
import { newlyUnlocked, validActiveHat } from "./features/pet/hats";
import { decayStats, feedStats, needsCare, playStats } from "./features/pet/care";
import { playPetSound } from "./lib/sfx";
import { petWindowLogicalSize, measurePetContentHeight, measurePetContentWidth, resolveEffectiveScale, petWrapBox } from "./lib/petWindow";
import { Bubble, SLOT_ROTATE_MS } from "./components/Bubble";
import { ensureAutostart } from "./features/startup/autostart";
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
  // Multi-pet (opsi B): window ini milik companion `ownId`; daftar shared via localStorage.
  const [ownId, setOwnId] = useState<string>(MAIN_COMPANION_ID);
  const [companions, setCompanions] = useState<Companion[]>(() => loadCompanions());
  const me: Companion | undefined = companions.find((c) => c.id === ownId) ?? companions[0];
  const isPrimary = ownId === MAIN_COMPANION_ID;
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
  const careTickRef = useRef(0);
  const panelRef = useRef<PanelTab | null>(null);
  panelRef.current = panel;
  const weatherRef = useRef<WeatherNow | null>(null);

  // CSS-only idle animation class (stretch / yawn / wiggle)
  const [idleAnimClass, setIdleAnimClass] = useState<string | null>(null);
  // Bubble sapaan teks (klik / habis dielus)
  const [greet, setGreet] = useState<{ text: string; key: number } | null>(null);
  const greetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dielus: tahan klik >= 500ms
  const [petting, setPetting] = useState(false);
  const pettingRef = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPetAt = useRef(0); // ritme elus beruntun bukan double-click buka panel
  // Menoleh ke kursor (override facing dari wander)
  const [faceHold, setFaceHold] = useState<1 | -1 | null>(null);

  const dragInfo = useRef<{ sx: number; sy: number; dragging: boolean } | null>(null);
  const petStateRef = useRef(petState);
  petStateRef.current = petState;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const ownIdRef = useRef(ownId);
  ownIdRef.current = ownId;
  const companionsRef = useRef(companions);
  companionsRef.current = companions;
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
    const id = ownIdRef.current;
    try {
      if (id === MAIN_COMPANION_ID) await invoke("pet_set_state", { next });
      else await invoke("pet_set_state_of", { id, next });
    } catch {
      try { await invoke("pet_set_state", { next }); } catch { /* preview */ }
    }
  }, []);

  // Identitas window ini (multi-pet B): label `pet` = main, `pet-<id>` = sekunder.
  // + live-reload daftar companion (storage event antar-window + event Tauri).
  useEffect(() => {
    try {
      const label = getCurrentWindow().label;
      const id = companionIdFromWindowLabel(label);
      setOwnId(id);
      // Fase awal rotasi pill per-pet agar tidak ganti barengan.
      setSlotTick(slotPhaseFor(id));
    } catch { /* web preview = main */ }
    setCompanions(loadCompanions());
    const onStorage = (e: StorageEvent) => {
      if (e.key === store.companions.key) setCompanions(loadCompanions());
    };
    window.addEventListener("storage", onStorage);
    let unlisten: (() => void) | null = null;
    try {
      const p = listen("deskpet://companions-changed", () => setCompanions(loadCompanions()));
      void (p as Promise<unknown>).then((u) => { unlisten = u as () => void; }).catch(() => {});
    } catch { /* preview */ }
    return () => {
      window.removeEventListener("storage", onStorage);
      try { unlisten?.(); } catch { /* noop */ }
    };
  }, []);

  // Init from Rust + settings.
  // Salinan tahan lama backend (file app-data) menang atas cache lokal bila ada.
  useEffect(() => {
    let cancelled = false;
    // Autostart: samakan OS dengan niat user (pasang bila setting on tapi
    // belum terpasang — "fix bila belum ada"). Best-effort, diam-diam.
    void ensureAutostart(loadSettings().autoStart).catch(() => {});
    // User lama: simpanannya belum punya otomasi baru (auto_task_nudge) —
    // gabungkan tanpa menghapus setting mereka.
    try { ensureAutomationDefaults(); } catch { /* noop */ }
    const myId = (() => {
      try { return companionIdFromWindowLabel(getCurrentWindow().label); } catch { return MAIN_COMPANION_ID; }
    })();
    invoke<PetState>("pet_get_state_of", { id: myId })
      .then((s) => { if (!cancelled) { petStateRef.current = s; setPetState(s); } })
      .catch(() => {
        invoke<PetState>("pet_get_state").then((s) => { if (!cancelled) { petStateRef.current = s; setPetState(s); } })
          .catch(() => { if (!cancelled) setBackend("web-preview"); });
      });
    invoke<boolean>("pet_is_visible").then((v) => { if (!cancelled) setVisible(v); }).catch(() => {});
    // Multi-pet B: kembalikan window sekunder setelah restart. Hanya primary
    // yang melakukannya (window sekunder belum ada saat boot, jadi aman dari
    // duplikat). Spawn idempoten: window yang sudah ada hanya di-show + fokus.
    // Sekuensial (bukan paralel) agar posisi cascade dihitung berurutan.
    // Timeout 12 dtk per window: satu window macet (build tidak balik) tidak
    // boleh menggantung boot — dilewati diam-diam, bisa dicoba lagi manual.
    if (myId === MAIN_COMPANION_ID) {
      void (async () => {
        try {
          const list = loadCompanions();
          for (const c of list) {
            if (cancelled || c.id === MAIN_COMPANION_ID) continue;
            const res = await spawnCompanionWindow(c.id, 12_000);
            if (cancelled) return;
            void res;
          }
        } catch { /* web preview: abaikan */ }
      })();
    }
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

  // Alert lokal: karakter membesar + bubble di atas pet sampai dikonfirmasi.
  const presentLocalAlert = useCallback((title: string, body: string, icon: IconName) => {
    void requestState("reminder");
    setAlertEnlarged(true);
    setAlertBubble({ title, body, icon });
    maybeCenterPetRef.current();
    toast(title, body, "reminder");
    setTimeout(() => {
      setAlertBubble((b) => (b?.title === title ? null : b));
      setAlertEnlarged(false);
    }, 60_000);
  }, [requestState]);

  // Scheduler terpusat jalan di primary; alert diteruskan ke presenter by role.
  const routeOrPresent = useCallback((kind: "reminder" | "prayer" | "timer", title: string, body: string, icon: IconName) => {
    const presenter = resolvePresenterFor(companionsRef.current, kind);
    if (presenter && presenter.id !== ownIdRef.current) {
      try {
        void Promise.resolve(emit("deskpet://present-alert", { targetId: presenter.id, title, body, icon }))
          .catch(() => { /* preview tanpa multi-window: tampilkan lokal */ presentLocalAlert(title, body, icon); });
      } catch { /* preview: fallback lokal */ presentLocalAlert(title, body, icon); }
      return;
    }
    presentLocalAlert(title, body, icon);
  }, [presentLocalAlert]);

  // Window sekunder: dengarkan alert yang dirutekan ke id-nya.
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    try {
      const p = listen("deskpet://present-alert", (ev) => {
        const pl = (ev.payload ?? {}) as { targetId?: string; title?: string; body?: string; icon?: IconName };
        if (pl.targetId !== ownIdRef.current || !pl.title) return;
        presentLocalAlert(pl.title, pl.body ?? "", (pl.icon ?? "bell") as IconName);
      });
      void (p as Promise<unknown>).then((u) => { unlisten = u as () => void; }).catch(() => {});
    } catch { /* preview */ }
    return () => { try { unlisten?.(); } catch { /* noop */ } };
  }, [presentLocalAlert]);
  const confirmAlert = useCallback(() => {
    setAlertEnlarged(false);
    setAlertBubble(null);
    setToasts((xs) => xs.filter((x) => x.kind !== "reminder"));
    void requestState("idle");
  }, [requestState]);

  // Sapaan teks di atas kepala (2,6 dtk, ganti bila spam).
  const showGreet = useCallback((text: string) => {
    if (greetTimer.current) clearTimeout(greetTimer.current);
    setGreet({ text, key: Date.now() });
    greetTimer.current = setTimeout(() => setGreet(null), 2600);
  }, []);

  // Konteks sapaan: hujan + lapar memengaruhi frasa.
  const greetCtx = () => ({
    raining: weatherGroup(weatherRef.current?.code) === "rain",
    hungry: (settingsRef.current.petStats?.hunger ?? 100) < 25,
  });

  // Toasts (in-app saja, tanpa izin OS). Pesan penting -> pet membesar 200%.
  // Alert PENTING (kind reminder) TIDAK masuk daftar toast kiri: sudah diwakili
  // bubble di atas pet yang clickable untuk konfirmasi. Toast kiri hanya untuk
  // info/sukses/error biasa (auto-hilang 4,2 dtk).
  useEffect(() => onToast((t) => {
    if (t.kind === "reminder") {
      setAlertEnlarged(true);
      void requestState("reminder");
      return;
    }
    setToasts((xs) => [t, ...xs].slice(0, 4));
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== t.id)), 4200);
  }), [requestState]);

  // Window size: compact pet vs expanded panel vs context menu
  // (the 230px context menu cannot fit in the 220px pet window).
  // Window DIPELUK ke sprite (tight, bukan 220px longgar): area transparan
  // yang ikut memblokir klik window di belakang jadi minimal dan ikut
  // mengecil/membesar bersama petScale. Aset 128px dirender 64px @100%
  // (PET_BASE_SCALE 0.5) -> window ~96px @scale 1.
  // Pill/bubble/timer tetap melebarkan window sesuai kebutuhan kontennya.
  // Suhu kota sholat untuk bubble suhu (cache 15 mnt, refresh 10 mnt).
  const [weather, setWeather] = useState<WeatherNow | null>(() => getCachedWeather("1301"));
  // Cache cuaca: dibaca SEMUA window dari cache shared (tanpa network) agar
  // tiap pet bisa menampilkan pill suhu sendiri-sendiri. Refresh cache 60 dtk
  // agar window sekunder ikut update setelah primary fetch dari network.
  useEffect(() => {
    if (settings.weatherEnabled === false) { setWeather(null); return; }
    const cityId = settings.prayerCityId ?? "1301";
    setWeather(getCachedWeather(cityId));
    const id = setInterval(() => setWeather(getCachedWeather(cityId)), 60_000);
    return () => clearInterval(id);
  }, [settings.prayerCityId, settings.weatherEnabled]);
  // Fetch network: HANYA primary (hemat kuota, anti-duplikat).
  useEffect(() => {
    if (!isPrimary) return;
    if (settings.weatherEnabled === false) return;
    const cityId = settings.prayerCityId ?? "1301";
    const cityName = settings.prayerCityName ?? "KOTA JAKARTA";
    let stop = false;
    const run = async () => {
      const w = await getWeather(cityId, cityName);
      if (!stop) setWeather(w);
    };
    void run();
    const id = setInterval(() => { void run(); }, 10 * 60_000);
    return () => { stop = true; clearInterval(id); };
  }, [isPrimary, settings.prayerCityId, settings.prayerCityName, settings.weatherEnabled]);
  weatherRef.current = weather;

  // Reaksi cuaca: transisi ke hujan -> toast info sekali (tidak spam).
  // Hanya primary yang bersuara agar N window tidak toast barengan.
  const wxGroupRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isPrimary) return;
    const g = weatherGroup(weather?.code);
    const prev = wxGroupRef.current;
    wxGroupRef.current = g;
    if (prev === null || prev === g || settings.weatherEnabled === false) return;
    if (g === "rain") {
      toast(`Hujan di ${weather?.cityLabel ?? "kotamu"}`, "Di dalam aja ya~", "info");
    }
  }, [isPrimary, weather, settings.weatherEnabled]);
  // Slot ambient di atas pet: SATU isi dalam satu waktu, bergantian tiap
  // periode (suhu <-> countdown sholat) via komponen <Bubble>.
  // Sapaan hasil interaksi (klik/elus) menyela slot sementara; slot lanjut
  // setelah overlay hilang.
  // Multi-pet B: fase awal + periode rotasi diacak per companion (hash id)
  // agar pill tiap pet ganti tidak barengan dan tidak sinkron permanen.
  // Ditaruh di sini (bukan di bawah) karena dipakai efek resize window.
  const interactOverlay = alertBubble === null && panel === null && (petting || greet !== null);
  // Multi-pet B: pill ambient tampil per-companion (default on); global
  // weatherEnabled/tempBubbleEnabled/prayerEnabled/prayerMiniEnabled tetap berlaku.
  const showTempPill = (me?.showTemp !== false)
    && settings.weatherEnabled !== false && settings.tempBubbleEnabled !== false && weather;
  const showMiniPill = (me?.showMini !== false)
    && settings.prayerEnabled && settings.prayerMiniEnabled !== false && prayerDay;
  const slotItems: Array<"temp" | "mini"> = [
    ...(showTempPill ? ["temp" as const] : []),
    ...(showMiniPill ? ["mini" as const] : []),
  ];
  // Rotasi jalan terus di background agar tidak ada lompatan saat salah satu
  // pill baru tersedia.
  const slotPeriodMs = SLOT_ROTATE_MS + slotPeriodJitterMsFor(ownId);
  const [slotTick, setSlotTick] = useState(0);
  useEffect(() => {
    if (slotItems.length < 2) return;
    const id = setInterval(() => setSlotTick((t) => t + 1), slotPeriodMs);
    return () => clearInterval(id);
  }, [slotItems.length, slotPeriodMs]);
  const slotCurrent = alertBubble === null && panel === null && !interactOverlay && slotItems.length > 0
    ? slotItems[slotTick % slotItems.length]
    : null;
  // Satu slot = satu offset pill (26px) bila ada isi.
  const aboveOffset = slotCurrent ? 26 : 0;
  // Multi-pet B: skala/spesies/palette milik companion window ini (fallback settings lama).
  const petScale = me?.scale ?? settings.petScale ?? 1;
  const effectiveScale = resolveEffectiveScale(petScale, alertEnlarged);
  const reserveAlert = alertBubble !== null;
  // Reserve lebar mengikuti KETERSEDIAAN (stabil, anti-flicker saat rotasi),
  // bukan isi yang sedang tampil.
  const reserveMini = !reserveAlert && !!showMiniPill && panel === null;
  const reserveTemp = !reserveAlert && !!showTempPill && panel === null;
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
            alert: reserveAlert, mini: reserveMini, temp: reserveTemp, timer: reserveTimer,
          });
          // Lebar awal dari tebakan (anti-flicker teks countdown tiap detik),
          // lalu dikoreksi dari hasil ukur DOM: tinggi agar bubble sepanjang
          // apa pun tidak kepotong, lebar agar pill/sapaan tidak kepotong
          // samping (temp-only dulu terjepit ~96px). Koreksi lebar dibatasi
          // agar tidak menyusut di bawah tebakan (anti-kedip tiap detik).
          finalW = guess.width;
          finalH = guess.height;
          await w.setSize(new LogicalSize(finalW, finalH));
          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
          if (cancelled) return;
          const measuredW = measurePetContentWidth(guess.width);
          // Window tidak boleh menyusut karena countdown ( narrower tiap detik
          // -> flicker ): hanya tumbuh, susut hanya bila konten hilang
          // (reserve berubah -> guess ikut berubah -> effect jalan ulang).
          if (measuredW > finalW) finalW = measuredW;
          const height = measurePetContentHeight(effectiveScale);
          if (Math.abs(height - guess.height) > 2) {
            finalH = height;
            await w.setSize(new LogicalSize(finalW, finalH));
          } else if (finalW !== guess.width) {
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
  }, [panel, menu, effectiveScale, reserveAlert, reserveMini, reserveTemp, reserveTimer, alertBubble, slotCurrent, greet !== null, petting]);

  // Scheduler tick (PRD §5.2: DB = source of truth, no duplicate, missed handling)
  // Multi-pet B: HANYA primary yang menjalankan scheduler (anti-duplikat antar
  // window); alert diteruskan ke presenter sesuai role companion.
  useEffect(() => {
    if (!isPrimary) return;
    const tick = () => {
      // Tamagotchi-lite: luruhkan stat max 1x/menit; peringatkan hanya saat
      // BARU melewati ambang (anti-spam).
      const nowMs = Date.now();
      if (nowMs - careTickRef.current > 60_000) {
        careTickRef.current = nowMs;
        const prev = settings.petStats;
        const cur = decayStats(prev, nowMs, petStateRef.current === "sleep");
        if (cur.hunger !== prev.hunger || cur.mood !== prev.mood || cur.energy !== prev.energy) {
          const next = { ...settings, petStats: cur, telemetryEnabled: false as const };
          saveSettings(next);
          setSettings(next);
        }
        const prevNeeds = needsCare(prev);
        for (const n of needsCare(cur)) {
          if (prevNeeds.includes(n)) continue;
          if (n === "hungry") { toast("Laper nih…", "Klik kanan → Kasih makan.", "info"); }
          else if (n === "lonely") { toast("Mager nih…", "Klik kanan → Ajak main.", "info"); }
          else { toast("Ngantuk…", "Pet tidur dulu ya.", "info"); void requestState("sleep"); }
        }
      }
      const fired = schedulerTick({ settings, onFired: () => {} });
      for (const r of fired) {
        // Dirutekan ke presenter role "reminder" (bisa window lain); lokal bila
        // presenternya window ini. Bubble/enlarge/toast diurus presentLocalAlert.
        routeOrPresent("reminder", r.title, "Pengingat jatuh tempo — klik untuk konfirmasi.", "bell");
        const autoSpeak = store.automations.all().find((a) => a.id === "auto_speak")?.enabled ?? true;
        if (autoSpeak && !settings.speechMuted) speak(`Pengingat: ${r.title}`, { muted: settings.speechMuted });
        else if (!settings.soundMuted) { try { new AudioContext().close(); } catch { /* no beep impl */ } }
        bump();
      }
      // Weekday morning summary (08:59–09:01 window, once/day)
      const now = new Date();
      if (now.getHours() === 9 && now.getMinutes() === 0) {
        const auto = store.automations.all().find((a) => a.id === "auto_morning");
        const today = now.toDateString();
        const lastDay = auto?.lastRunAt ? new Date(auto.lastRunAt).toDateString() : null;
        if (auto?.enabled && lastDay !== today) {
          const dueToday = store.todos.all().filter((t) => t.status !== "completed").length;
          // Sama seperti pengingat lain: dirutekan ke presenter role "reminder".
          routeOrPresent("reminder", "Ringkasan pagi", `${dueToday} tugas terbuka — klik untuk konfirmasi.`, "sun");
          auto.lastRunAt = now.toISOString();
          store.automations.save(store.automations.all().map((a) => (a.id === auto.id ? auto : a)));
        }
      }
      // Nudge tugas terbuka (13:00 & 17:30, maks 1x/slot/hari, hanya bila ada
      // yang actionable). Sengaja toast lembut (tanpa enlarge/bubble) agar
      // tidak mengganggu kerja — matikan via Otomatisasi bila berisik.
      {
        const auto = store.automations.all().find((a) => a.id === "auto_task_nudge");
        if (auto?.enabled) {
          const fire = shouldFireTaskNudge(now, store.todos.all(), auto.lastRunAt);
          if (fire) {
            const overdue = countOverdue(fire.open, now);
            toast(
              `Masih ada ${fire.open.length} tugas terbuka`,
              overdue > 0
                ? `${overdue} lewat jatuh tempo — cicil yuk, buka tab Tugas.`
                : "Yuk cicil — buka tab Tugas untuk lihat.",
              "info",
            );
            auto.lastRunAt = fire.key;
            store.automations.save(store.automations.all().map((a) => (a.id === auto.id ? auto : a)));
            bump();
          }
        }
      }
      // Timer countdown handled separately
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, bump, requestState, isPrimary, routeOrPresent]);

  // Prayer ticker: cache-sync + alert masuk waktu & H-X menit (bubble di atas pet + adzan).
  // Local-first: pakai cache dulu, network best-effort 1x per kota per hari.
  // Multi-pet B: SEMUA window melukis countdown dari cache shared (pill per-pet);
  // hanya primary yang fetch network + routing alert (anti-duplikat).
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
      //    per hari — tidak perlu fetch tiap 15 dtk). HANYA primary.
      if (!isPrimary) return;
      if (!day || day.date !== ymd) {
        const live = await getPrayerDay(cityId, cityName, now);
        if (cancelled) return;
        if (live) {
          day = live;
          setPrayerDay(live);
          // Audit hanya network sungguhan (sekali per kota per hari).
          if (live.source !== "cache") {
            store.audit.push({
              id: uid("boot"), actionId: "prayer.fetch", source: "prayer",
              status: "executed", confirmationRequired: false, createdAt: new Date().toISOString(),
            });
          }
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
          // Multi-pet B: alert sholat dirutekan ke presenter role "prayer".
          // Bubble besar hanya bila presenternya window ini (diurus routeOrPresent).
          if (settings.prayerBubbleEnabled !== false) {
            routeOrPresent("prayer", `Masuk waktu ${name} · ${timeOf(day, name)}`, "Yuk sholat dulu — klik untuk konfirmasi.", "moonStar");
          } else {
            toast(`${name} ${timeOf(day, name)}`, `${cityName} · saatnya sholat`, "reminder");
          }
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
    // Countdown presisi menit: tick 30 dtk cukup (hemat re-render + resize window).
    const fast = setInterval(() => setPrayerTick((t) => t + 1), 30_000);
    const slow = setInterval(() => void check(), 15_000);
    return () => { cancelled = true; clearInterval(fast); clearInterval(slow); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.prayerEnabled, isPrimary, routeOrPresent, settings.prayerCityId, settings.prayerCityName, settings.prayerAdzanEnabled, settings.prayerBubbleEnabled, settings.prayerReminderMins, settings.quietHoursEnabled, settings.quietStart, settings.quietEnd, settings.soundMuted, settings.speechMuted]);
  // Timer terpusat multi-window (konsisten dengan scheduler §5.2): state hidup
  // di localStorage sehingga SEMUA window menampilkan countdown yang sama;
  // HANYA primary yang mengeksekusi selesai + merutekan alert ke presenter
  // role "timer" (bisa window lain). Timer lama (ref per-window) membuat timer
  // "ga work" — selesai/hilang di window yang salah.
  const completedTimerEnd = useRef<number | null>(null);
  const timerStart = useCallback((secs: number, label = "Fokus") => {
    const dur = Math.max(1, Math.round(secs));
    const t = {
      endAt: Date.now() + dur * 1000,
      label: label.trim() ? label.trim().slice(0, 24) : "Fokus",
      durationSecs: dur,
      startedBy: ownIdRef.current,
      startedAt: Date.now(),
    };
    completedTimerEnd.current = null;
    saveSharedTimer(t);
    setTimerLeft(sharedTimerLeft(t)); setTimerLabel(t.label);
    void requestState("attention");
    toast(`${t.label} dimulai`, `${Math.round(dur / 60)} menit · countdown tampil di semua window`, "info");
    bump();
  }, [requestState, bump]);
  useEffect(() => {
    const refresh = () => {
      const t = loadSharedTimer();
      const left = sharedTimerLeft(t);
      setTimerLeft(left);
      if (t) setTimerLabel(t.label);
      // Eksekusi selesai: primary saja (anti-duplikat antar window).
      // Guard endAt agar timer yang sama tidak dieksekusi dua kali.
      if (t && left === 0 && ownIdRef.current === MAIN_COMPANION_ID && completedTimerEnd.current !== t.endAt) {
        completedTimerEnd.current = t.endAt;
        clearSharedTimer();
        setTimerLeft(null);
        // Opsi user: selesai tanpa alert = timer diam-diam selesai (tetap refresh panel).
        if (settingsRef.current.timerDoneAlertEnabled !== false) {
          routeOrPresent("timer", `${t.label} selesai`, "Waktunya istirahat / lanjut — klik untuk konfirmasi.", "timer");
          if (!settingsRef.current.speechMuted) speak("Timer selesai.", { muted: settingsRef.current.speechMuted });
        }
        bump();
      }
    };
    refresh();
    const id = setInterval(refresh, 1000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === TIMER_KEY) {
        completedTimerEnd.current = null;
        refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => { clearInterval(id); window.removeEventListener("storage", onStorage); };
  }, [routeOrPresent, bump]);

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
  // Tahan 500ms untuk mulai mengelus (batal bila jadi drag / ada alert).
  const PET_HOLD_MS = 500;
  const cancelHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
  };
  const stopPetting = () => {
    cancelHold();
    pettingRef.current = false;
    setPetting(false);
  };

  // Spesies window ini (multi-pet B) untuk sapaan; fallback settings lama.
  const mySpecies = () =>
    companionsRef.current.find((c) => c.id === ownIdRef.current)?.species
    ?? settingsRef.current.petSpecies ?? "cat";

  const endDrag = useCallback((wasDragging: boolean) => {
    // Klik pet = konfirmasi pesan penting (kecilkan kembali). Ini yang paling
    // intuitif: user mengklik karakter/toast/bubble/Esc, semuanya mengecilkan.
    if (alertEnlarged) { confirmAlert(); return; }
    if (wasDragging) void requestState("idle");
    else {
      void requestState("react"); // plain click = happy react
      showGreet(randomGreeting(mySpecies(), greetCtx()));
    }
  }, [requestState, alertEnlarged, confirmAlert, showGreet]);
  const onPetMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click initiates dragging, right click is for menu
    dragInfo.current = { sx: e.clientX, sy: e.clientY, dragging: false };
    void requestState("dragged");
    // Jadwalkan elus: tahan tanpa gerak -> mode dielus (bukan drag).
    cancelHold();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      if (dragInfo.current?.dragging || alertEnlarged) return;
      pettingRef.current = true;
      setPetting(true);
      playPetSound(settingsRef.current.soundMuted);
      void requestState("react");
    }, PET_HOLD_MS);
  }, [requestState, alertEnlarged]);
  const onPetMouseMove = useCallback((e: React.MouseEvent) => {
    const d = dragInfo.current;
    if (d && !d.dragging && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 5) {
      d.dragging = true;
      stopPetting(); // gerak = drag, bukan elus
      setFaceHold(null);
      void requestState("dragged");
      try { void getCurrentWindow().startDragging(); } catch { /* preview */ }
      return;
    }
    // Menoleh ke kursor saat idle + belum drag (wander sudah jeda saat hover).
    // Sisi kursor selalu dicatat untuk mode pemalu (arah kabur = menjauhi sisi ini).
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      cursorSide.current = {
        sx: e.clientX >= r.left + r.width / 2 ? 1 : -1,
        sy: e.clientY >= r.top + r.height / 2 ? 1 : -1,
      };
    }
    if (!d?.dragging && petStateRef.current === "idle") {
      const rr = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setFaceHold(sideOf(e.clientX, rr.left + rr.width / 2));
    }
  }, [requestState]);
  // Selesaikan satu sesi elus: hitung, cek topi baru, sapa bahagia.
  const finishPetting = useCallback(() => {
    stopPetting();
    lastPetAt.current = Date.now();
    const prev = settingsRef.current.pettingTotal ?? 0;
    const next = prev + 1;
    const updated = { ...settingsRef.current, pettingTotal: next, telemetryEnabled: false as const };
    saveSettings(updated);
    setSettings(updated);
    for (const h of newlyUnlocked(prev, next)) {
      toast(`Topi baru terbuka: ${h.emoji} ${h.name}`, "Lihat di Pengaturan → Topi.", "success");
    }
    showGreet(randomGreeting(mySpecies(), { happy: true }));
    void requestState("idle");
  }, [requestState, showGreet]);
  const onPetMouseUp = useCallback(() => {
    const d = dragInfo.current;
    dragInfo.current = null;
    cancelHold();
    if (pettingRef.current) { finishPetting(); return; }
    if (!d) return;
    endDrag(d.dragging);
  }, [endDrag, finishPetting]);

  // Backup: OS-level drag release (covers startDragging hijack + cursor
  // leaving the pet element mid-drag). Guarantees expression resets to idle.
  useEffect(() => {
    const onUp = () => {
      const d = dragInfo.current;
      dragInfo.current = null;
      cancelHold();
      if (pettingRef.current) { finishPetting(); return; }
      if (!d) return;
      endDrag(d.dragging);
    };
    const onBlur = () => {
      cancelHold();
      const d = dragInfo.current;
      if (pettingRef.current) { stopPetting(); }
      if (d?.dragging) {
        dragInfo.current = null;
        void requestState("idle");
      } else {
        dragInfo.current = null;
      }
      setFaceHold(null);
    };
    window.addEventListener("mouseup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [endDrag, finishPetting, requestState]);

  // Menoleh hanya saat idle; state lain (walk/react/drag) pakai facing aslinya.
  useEffect(() => {
    if (petState !== "idle") setFaceHold(null);
  }, [petState]);

  const openTab = useCallback((t: PanelTab) => {
    setMenu(null);
    setPanel(t);
  }, []);

  // Rawat pet (menu klik kanan / panel Pengaturan): stat + suara + aksi.
  const onCare = useCallback((kind: "feed" | "play") => {
    const cur = settingsRef.current.petStats ?? { hunger: 100, mood: 100, energy: 100, updatedAt: new Date(0).toISOString() };
    const stats = kind === "feed" ? feedStats(cur) : playStats(cur);
    const updated = { ...settingsRef.current, petStats: stats, telemetryEnabled: false as const };
    saveSettings(updated);
    setSettings(updated);
    if (kind === "feed") {
      playPetSound(settingsRef.current.soundMuted);
      toast("Nyam nyam!", "Kenyang 100%.", "success");
      void requestState("react");
    } else {
      playPetSound(settingsRef.current.soundMuted);
      toast("Asik main!", "Mood 100%.", "success");
      void requestState("jump");
    }
  }, [requestState]);

  const onMenuPick = useCallback(async (a: MenuAction) => {
    setMenu(null);
    const clampScale = (v: number) => Math.min(2, Math.max(0.5, Math.round(v * 10) / 10));
    // Resize milik companion PEMILIK WINDOW ini (yang dirender = me.scale).
    // settings.petScale ikut disync sebagai default global + agar slider
    // Pengaturan menampilkan nilai yang benar.
    const setOwnScale = (v: number) => {
      const id = ownIdRef.current;
      const next = clampScale(v);
      setCompanions(updateCompanion(id, { scale: next }));
      try {
        void Promise.resolve(emit("deskpet://companions-changed", "changed")).catch(() => { /* preview */ });
      } catch { /* preview */ }
      setSettings((s) => ({ ...s, petScale: next }));
    };
    const curScale = () =>
      companionsRef.current.find((c) => c.id === ownIdRef.current)?.scale
      ?? settingsRef.current.petScale ?? 1;
    switch (a) {
      case "timer-5": timerStart(5 * 60, "Fokus"); break;
      case "timer-15": timerStart(15 * 60, "Fokus"); break;
      case "timer-25": timerStart(25 * 60, "Fokus"); break;
      case "feed": onCare("feed"); break;
      case "play": onCare("play"); break;
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
        const dirs: WanderDirection[] = ["random", "horizontal", "vertical", "edges"];
        const cur = settings.wanderDirection ?? "random";
        const next = dirs[(dirs.indexOf(cur) + 1) % dirs.length];
        setSettings((s) => ({ ...s, wanderDirection: next }));
        const names: Record<WanderDirection, string> = {
          random: "Acak (Semua Arah)",
          horizontal: "Kiri – Kanan (Patroli)",
          vertical: "Atas – Bawah",
          edges: "Pinggir (Keliling Tepi)",
        };
        toast("Arah jalan diubah", names[next], "info");
        break;
      }
      case "toggle-top": setSettings((s) => ({ ...s, alwaysOnTop: !s.alwaysOnTop })); break;
      case "toggle-motion": setSettings((s) => ({ ...s, reducedMotion: !s.reducedMotion })); break;
      case "scale-up": setOwnScale(curScale() + 0.1); break;
      case "scale-down": setOwnScale(curScale() - 0.1); break;
      case "scale-reset": setOwnScale(1); break;
      case "sleep": stopSpeech(); void requestState("sleep"); break;
      case "wake": void requestState("idle"); break;
      case "hide": void setVisibleBoth(false); break;
      case "quit":
        try { await invoke("app_quit"); }
        catch { window.close(); }
        break;
    }
  }, [requestState, setVisibleBoth, timerStart, settings.wanderPace, settings.wanderDirection, onCare]);

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

  const alertActive = alertBubble !== null;
  const moodLow = (settings.petStats?.mood ?? 100) < 25; // mager: berhenti jalan
  const wanderPaused = menu !== null || panel !== null || petState === "dragged" || hovered || alertActive || moodLow;
  // Mode pemalu: kabur saat hover — kecuali jinak sementara (tahan Shift),
  // panel/menu/alert terbuka, mood rendah, atau reduced motion. Toggle-nya
  // di tab Kawan / Pengaturan (bukan di pet-nya, yang justru kabur).
  const cursorSide = useRef<{ sx: 1 | -1; sy: 1 | -1 } | null>(null);
  const shiftHeld = useRef(false);
  const lastFleeAt = useRef(0);
  const [fleeReq, setFleeReq] = useState<{ key: number; dx: number; dy: number } | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftHeld.current = true;
    };
    const offKey = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftHeld.current = false;
    };
    const offBlur = () => { shiftHeld.current = false; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", offKey);
    window.addEventListener("blur", offBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", offKey);
      window.removeEventListener("blur", offBlur);
    };
  }, []);
  const shyArmed = (me?.shy === true)
    && !settings.reducedMotion && petState === "idle"
    && menu === null && panel === null && !alertActive && !moodLow;
  useEffect(() => {
    if (!hovered || !shyArmed || shiftHeld.current) return;
    if (Date.now() - lastFleeAt.current < FLEE_COOLDOWN_MS) return;
    const t = setTimeout(() => {
      if (shiftHeld.current) return; // jinak: Shift ditahan saat timeout tiba
      if (Date.now() - lastFleeAt.current < FLEE_COOLDOWN_MS) return;
      const s = cursorSide.current;
      if (!s) return;
      lastFleeAt.current = Date.now();
      setFleeReq((k) => ({ key: (k?.key ?? 0) + 1, dx: -s.sx, dy: -s.sy }));
    }, FLEE_HOVER_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, shyArmed]);
  const { offset, facing, walkSpeed, centerPet } = useWander({
    enabled: settings.wanderEnabled,
    wanderPace: settings.wanderPace ?? "random",
    wanderDirection: settings.wanderDirection ?? "random",
    petState,
    reducedMotion: settings.reducedMotion,
    paused: wanderPaused,
    requestState,
    startDelayMs: phaseDelayMsFor(ownId),
    flee: fleeReq,
  });

  // Alert penting -> pet kembali ke tengah layar agar jadi fokus.
  // Ditulis via ref (bukan useCallback) karena dipakai efek interval yang
  // dideklarasikan lebih awal di file — menghindari TDZ block-scoped const.
  // Isi selalu fresh via settingsRef/panelRef; centerPet stabil dari hook.
  // H-X pengingat sholat (info) sengaja TIDAK center — hanya yang enlarge.
  const maybeCenterPetRef = useRef(() => {});
  maybeCenterPetRef.current = () => {
    if (!shouldCenterPet(settingsRef.current.centerOnAlert, panelRef.current !== null)) return;
    void centerPet();
  };

  // Idle micro-behavior: karakter aktif melakukan aksi kecil saat idle
  const idlePaused = wanderPaused || petState !== "idle";
  useIdleBehavior({
    enabled: !settings.reducedMotion,
    petState,
    paused: idlePaused,
    onIdleAction: (ev) => {
      switch (ev.kind) {
        case "jump":
          void requestState("jump");
          break;
        case "speak":
          void requestState("speak");
          break;
        case "react":
          void requestState("react");
          break;
        case "stretch":
        case "yawn":
        case "wiggle": {
          const cls = `dp-idle-${ev.kind}`;
          setIdleAnimClass(cls);
          // Durasi: stretch=850ms, yawn=1100ms, wiggle=700ms
          const dur = ev.kind === "yawn" ? 1200 : ev.kind === "stretch" ? 950 : 800;
          setTimeout(() => setIdleAnimClass(null), dur);
          break;
        }
        default:
          break;
      }
    },
  });

  // Quick NL from hidden? double-click opens assistant.
  // Dikecualikan: klik beruntun dalam 800ms setelah selesai dielus = ritme
  // elus (klik-tahan-lepas), bukan niat buka panel.
  const onDoubleClick = useCallback(() => {
    if (alertEnlarged) { confirmAlert(); return; }
    if (isPettingRhythm(lastPetAt.current)) return;
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
  const miniNext = slotCurrent === "mini" && prayerDay
    ? getNextPrayer(prayerDay, new Date())
    : null;
  const tempBubble = slotCurrent === "temp" ? weather : null;

  return (
    <div
      // has-bubble = ada konten di atas pet (pill/alert/overlay): jangkar ke
      // bawah agar overlay absolute tidak kepotong tepi atas. Tanpa ini saat
      // sapaan tampil sendirian layout center -> kepotong ~7px.
      className={`dp-root${panel ? " with-panel" : ""}${(alertBubble || miniNext || tempBubble || interactOverlay) && !panel ? " has-bubble" : ""}${reserveTimer && !panel ? " has-status" : ""}`}
      data-companion={ownId}
      data-companion-name={me?.name ?? ""}
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
      {!alertBubble && slotCurrent === "temp" && tempBubble && (
        <Bubble position="top" testId="temp-bubble" className="dp-bubble-temp"
          onClick={() => openTab("prayer")}
          title="Klik untuk buka cuaca + jadwal sholat">
          <span className="dp-line"><Icon name={tempBubble.icon} size={12} /> {tempBubble.tempC}° {tempBubble.label}</span>
        </Bubble>
      )}
      {!alertBubble && slotCurrent === "mini" && miniNext && (
        <Bubble position="top" testId="prayer-mini" className="dp-bubble-mini"
          onClick={() => openTab("prayer")}
          title="Klik untuk buka jadwal sholat">
          <span className="dp-line"><Icon name="moonStar" size={12} /> {miniNext.name} {timeOf(prayerDay!, miniNext.name)} · {formatCountdown(miniNext.at.getTime() - Date.now())}</span>
        </Bubble>
      )}
      <div className="dp-pet-stack" style={{ ...petWrapBox(effectiveScale), position: "relative", ["--above" as string]: `${aboveOffset}px` }} data-testid="pet-stack">
      <div
        className={`dp-pet-wrap${alertEnlarged ? " dp-alert" : ""}${idleAnimClass ? ` ${idleAnimClass}` : ""}${petting ? " dp-petting" : ""}`}
        style={backend === "web-preview"
          ? { ...petWrapBox(effectiveScale), transform: `translate(${offset.x}px, ${offset.y}px) scale(${(faceHold ?? facing) * effectiveScale}, ${effectiveScale})` }
          : { ...petWrapBox(effectiveScale), transform: `scale(${(faceHold ?? facing) * effectiveScale}, ${effectiveScale})` }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setFaceHold(null); }}
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
          species={me?.species ?? settings.petSpecies}
          paletteId={me?.paletteId ?? settings.petPaletteId}
          customColor={me?.customColor ?? settings.petCustomColor}
          hat={validActiveHat(settings.activeHat, settings.pettingTotal ?? 0)}
          speed={walkSpeed}
          onTap={() => {}}
        />
      </div>
      {/* Overlay teks: hanya saat tidak ada alert (alert punya bubble sendiri).
          Di layer stack TANPA flip agar tidak ikut kecermin (scaleX -1 di wrap). */}
      {!alertBubble && !petting && greet && (
        <span key={greet.key} className="dp-greet" data-testid="pet-greet" aria-hidden="true">
          {greet.text}
        </span>
      )}
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
          refreshKey={refreshKey} bump={bump} timerStart={timerStart} timerLeft={timerLeft} onCare={onCare}
          companions={companions} setCompanions={(c) => { saveCompanions(c); setCompanions(c); }} ownId={ownId} />
      )}

      <div className="dp-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`dp-toast ${t.kind}`}
            role="status"
            onClick={() => setToasts((xs) => xs.filter((x) => x.id !== t.id))}
            title="Klik untuk tutup">
            <div className="dp-toast-main">
              <span className="dp-toast-icon"><Icon name={TOAST_ICON[t.kind]} size={14} /></span>
              <div><b>{t.title}</b>{t.body ? <div>{t.body}</div> : null}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Re-export for assistant execute path typing
export type { PanelTab };

/** Ritme elus (klik-tahan-lepas beruntun) bukan double-click buka panel. */
export function isPettingRhythm(lastPetAtMs: number, nowMs = Date.now(), windowMs = 800): boolean {
  return nowMs - lastPetAtMs < windowMs;
}
