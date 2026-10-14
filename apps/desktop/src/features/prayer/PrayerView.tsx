import { useEffect, useMemo, useState } from "react";
import {
  OBLIGATORY, PRAYER_NAMES, POPULAR_CITIES,
  fetchCities, formatCountdown, getCachedPrayerDay, getNextPrayer, getPrayerDay,
  playAdzanBeep, timeOf, toYMD,
  type PrayerCity, type PrayerDay,
} from "./prayer";
import { loadSettings, saveSettings, store, uid, type DeskSettings } from "../../lib/store";
import { toast } from "../../lib/notify";
import { speak } from "../../lib/tts";
import { Icon } from "../../components/Icon";

interface Props {
  settings: DeskSettings;
  setSettings: (s: DeskSettings) => void;
  bump: () => void;
}

export function PrayerView({ settings, setSettings, bump }: Props) {
  const [day, setDay] = useState<PrayerDay | null>(() => getCachedPrayerDay(settings.prayerCityId ?? "1301"));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [cities, setCities] = useState<PrayerCity[]>(POPULAR_CITIES);
  const [q, setQ] = useState("");
  const [now, setNow] = useState(() => new Date());

  const upd = (patch: Partial<DeskSettings>) => {
    const next = { ...settings, ...patch, telemetryEnabled: false as const };
    saveSettings(next);
    setSettings(next);
  };

  const load = async (cityId: string, cityName: string) => {
    setLoading(true);
    setErr("");
    const res = await getPrayerDay(cityId, cityName, new Date());
    setLoading(false);
    if (res) {
      setDay(res);
      store.audit.push({
        id: uid("a"), actionId: "prayer.fetch", source: "prayer",
        status: "executed", confirmationRequired: false, createdAt: new Date().toISOString(),
      });
    } else {
      setErr("Gagal memuat jadwal (offline & belum ada cache). Coba lagi saat online.");
    }
  };

  useEffect(() => {
    void load(settings.prayerCityId, settings.prayerCityName);
    void fetchCities().then(setCities);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.prayerCityId]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const next = useMemo(() => (day ? getNextPrayer(day, now) : null), [day, now]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return cities.slice(0, 60);
    return cities.filter((c) => c.lokasi.toLowerCase().includes(query)).slice(0, 60);
  }, [cities, q]);

  const testAdzan = () => {
    if (!settings.soundMuted) playAdzanBeep(3);
    if (!settings.speechMuted) speak("Tes adzan. Sudah masuk waktu sholat.", { muted: false });
    toast("Tes adzan", "Bunyi + suara DeskPet", "reminder");
  };

  const makeReminder = () => {
    if (!next) return;
    const t = new Date().toISOString();
    const all = store.reminders.all();
    all.unshift({
      id: uid("r"), title: `Sholat ${next.name} (${timeOf(day!, next.name)})`,
      dueAt: next.at.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta",
      recurrence: "none", status: "active", createdAt: t, updatedAt: t,
    });
    store.reminders.save(all);
    bump();
    toast("Pengingat sholat dibuat", next.name, "success");
  };

  // Pastikan settings lama (tanpa field prayer) tetap punya default.
  useEffect(() => {
    const s = loadSettings();
    if (settings.prayerCityId == null) upd({ prayerCityId: s.prayerCityId, prayerCityName: s.prayerCityName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="dp-muted">
        <span className="dp-line"><Icon name="moonStar" size={12} /> Sumber MyQuran (Kemenag) + fallback Aladhan · opt-in · cache offline {day ? `· ${day.source}` : ""} · {toYMD(new Date())}</span>
      </div>

      <label className="dp-check">
        <input type="checkbox" checked={settings.prayerEnabled ?? true}
          onChange={(e) => upd({ prayerEnabled: e.target.checked })} />
        Jadwal sholat aktif (ambil + cache otomatis)
      </label>
      <label className="dp-check">
        <input type="checkbox" checked={settings.prayerMiniEnabled ?? true}
          onChange={(e) => upd({ prayerMiniEnabled: e.target.checked })} />
        Tampilkan pill countdown di atas pet
      </label>
      <label className="dp-check">
        <input type="checkbox" checked={settings.prayerBubbleEnabled ?? true}
          onChange={(e) => upd({ prayerBubbleEnabled: e.target.checked })} />
        Tampilkan bubble peringatan adzan di atas pet
      </label>
      <label className="dp-check">
        <input type="checkbox" checked={settings.prayerAdzanEnabled ?? true}
          onChange={(e) => upd({ prayerAdzanEnabled: e.target.checked })} />
        Adzan saat masuk waktu (bunyi + suara)
      </label>
      <div className="dp-row" style={{ alignItems: "center" }}>
        <label htmlFor="dp-prayer-before" className="dp-muted" style={{ minWidth: 120 }}>Ingatkan sebelum:</label>
        <select id="dp-prayer-before" className="dp-in" style={{ maxWidth: 130 }}
          value={settings.prayerReminderMins ?? 10}
          onChange={(e) => upd({ prayerReminderMins: Number(e.target.value) })}>
          <option value={0}>mati</option>
          <option value={5}>5 menit</option>
          <option value={10}>10 menit</option>
          <option value={15}>15 menit</option>
          <option value={30}>30 menit</option>
        </select>
      </div>

      <div className="dp-row">
        <input className="dp-in" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Cari kota… (mis. Surabaya)" aria-label="Cari kota" />
        <button className="dp-btn sm" onClick={() => void load(settings.prayerCityId, settings.prayerCityName)} title="Muat ulang jadwal">
          {loading ? "…" : <Icon name="rotate" size={13} />}
        </button>
      </div>
      <div className="dp-row">
        <select className="dp-in" aria-label="Kota"
          value={settings.prayerCityId}
          onChange={(e) => {
            const c = cities.find((x) => x.id === e.target.value) ?? POPULAR_CITIES.find((x) => x.id === e.target.value);
            upd({ prayerCityId: e.target.value, prayerCityName: c?.lokasi ?? settings.prayerCityName });
          }}>
          {POPULAR_CITIES.map((c) => <option key={`pop-${c.id}`} value={c.id}>{c.lokasi}</option>)}
          {filtered.filter((c) => !POPULAR_CITIES.some((p) => p.id === c.id)).map((c) => (
            <option key={c.id} value={c.id}>{c.lokasi}</option>
          ))}
        </select>
      </div>
      <div className="dp-muted">{settings.prayerCityName} · {cities.length} kota tersedia</div>

      {err && <div className="dp-warn">{err}</div>}

      {next && day && (
        <div className="dp-confirm" data-testid="prayer-next">
          <span className="dp-line"><Icon name="hourglass" size={13} /> Berikutnya: <b>{next.name} {timeOf(day, next.name)}</b> · {formatCountdown(next.at.getTime() - now.getTime())} lagi</span>
          <div className="dp-row">
            <button className="dp-btn sm primary" onClick={makeReminder}><Icon name="plus" size={13} /> Jadi pengingat</button>
            <button className="dp-btn sm" onClick={testAdzan}><Icon name="volume" size={13} /> Tes adzan</button>
          </div>
        </div>
      )}

      <div className="dp-list" data-testid="prayer-list">
        {day ? PRAYER_NAMES.map((n) => {
          const isNext = next?.name === n;
          const wajib = (OBLIGATORY as readonly string[]).includes(n);
          return (
            <div key={n} className={`dp-item${isNext ? " sel" : ""}`}>
              <div><span className="dp-line"><Icon name={wajib ? "moonStar" : "sun"} size={13} /><b>{n}</b>{isNext ? <span className="dp-badge">berikutnya</span> : null}</span></div>
              <div><b>{timeOf(day, n)}</b></div>
            </div>
          );
        }) : (
          <div className="dp-muted">{loading ? "Memuat jadwal…" : "Belum ada jadwal."}</div>
        )}
      </div>
      <div className="dp-muted">Bubble muncul di atas pet saat masuk waktu + H-{settings.prayerReminderMins} menit (jika &gt; 0). Klik bubble untuk menutup.</div>
    </div>
  );
}
