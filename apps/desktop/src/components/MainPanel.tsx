/** MainPanel: all PRD surfaces in one expandable window (P2–P4 local-first). */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { parseCommand, validateAction, type ActionRequest } from "../features/assistant/parser";
import { addCompanion, loadCompanions, removeCompanion, saveCompanions, updateCompanion, exportBackup, importBackup, loadSettings, saveSettings, store, uid, MAIN_COMPANION_ID, MAX_COMPANIONS, type Automation, type CalEvent, type Companion, type DeskSettings, type Note, type RecurrenceRule, type Reminder, type Todo, type WanderPace, type WanderDirection } from "../lib/store";
import { COMPANION_ROLES, defaultNameFor, normalizeCompanionList, type CompanionRole } from "../features/pet/companions";
import { formatDue, isQuietHours, nextOccurrence, parseDurationSeconds, parseNaturalDateTime, toUTCISOString } from "../lib/time";
import { recurrenceLabel, relDue, reminderBadge, splitReminders } from "../lib/reminders";
import { Icon, type IconName } from "./Icon";
import { toast } from "../lib/notify";
import { availableVoices, speak, stopSpeech, ttsSupported } from "../lib/tts";
import { CAT_PALETTES, CUSTOM_PALETTE_ID } from "../features/pet/palettes";
import { PET_SPECIES, type PetSpecies } from "../features/pet/species";
import { HATS, unlockedHats } from "../features/pet/hats";
import { PrayerView } from "../features/prayer/PrayerView";
import { AutostartView } from "../features/startup/AutostartView";

export type PanelTab = "assistant" | "reminders" | "tasks" | "notes" | "timer" | "calendar" | "prayer" | "auto" | "settings" | "log";

interface Props {
  tab: PanelTab;
  setTab: (t: PanelTab) => void;
  onClose: () => void;
  settings: DeskSettings;
  setSettings: (s: DeskSettings) => void;
  refreshKey: number;
  bump: () => void;
  timerStart: (secs: number, label?: string) => void;
  timerLeft: number | null;
  onCare?: (kind: "feed" | "play") => void;
  companions?: Companion[];
  setCompanions?: (c: Companion[]) => void;
  /** Companion pemilik window tempat panel ini dibuka (double-click pet itu). */
  ownId?: string;
}

const TABS: { id: PanelTab; icon: IconName; title: string }[] = [
  { id: "assistant", icon: "chat", title: "Asisten" }, { id: "reminders", icon: "bell", title: "Pengingat" },
  { id: "tasks", icon: "task", title: "Tugas" }, { id: "notes", icon: "note", title: "Catatan" },
  { id: "timer", icon: "timer", title: "Timer" }, { id: "calendar", icon: "calendar", title: "Kalender" },
  { id: "prayer", icon: "moonStar", title: "Jadwal Sholat" },
  { id: "auto", icon: "settings", title: "Otomatisasi" }, { id: "settings", icon: "sliders", title: "Pengaturan" },
  { id: "log", icon: "history", title: "Log" },
];

export function MainPanel(p: Props) {
  // Multi-pet: fallback lokal agar caller lama (preview/test) tetap jalan.
  const [localCompanions, setLocalCompanions] = useState<Companion[]>(() => loadCompanions());
  const companions = p.companions ?? localCompanions;
  const setCompanions = (c: Companion[]) => {
    saveCompanions(c);
    (p.setCompanions ?? setLocalCompanions)(c);
  };
  return (
    <div className="dp-panel" data-testid="main-panel" role="dialog" aria-label="DeskPet panel">
      <div className="dp-panel-head">
        <div className="dp-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={p.tab === t.id}
              className={`dp-tab${p.tab === t.id ? " on" : ""}`}
              onClick={() => p.setTab(t.id)} title={t.title}><Icon name={t.icon} size={16} /></button>
          ))}
        </div>
        <button className="dp-x" onClick={p.onClose} title="Tutup (Esc)"><Icon name="x" size={14} /></button>
      </div>
      <div className="dp-panel-body">
        {p.tab === "assistant" && <Assistant onAction={p.bump} timerStart={p.timerStart} />}
        {p.tab === "reminders" && <Reminders bump={p.bump} rkey={p.refreshKey} settings={p.settings} />}
        {p.tab === "tasks" && <Tasks bump={p.bump} rkey={p.refreshKey} />}
        {p.tab === "notes" && <Notes bump={p.bump} rkey={p.refreshKey} />}
        {p.tab === "timer" && <TimerView timerStart={p.timerStart} timerLeft={p.timerLeft} settings={p.settings} setSettings={p.setSettings} />}
        {p.tab === "calendar" && <Calendar bump={p.bump} rkey={p.refreshKey} />}
        {p.tab === "prayer" && <PrayerView settings={p.settings} setSettings={p.setSettings} bump={p.bump} />}
        {p.tab === "auto" && <Automations bump={p.bump} rkey={p.refreshKey} />}
        {p.tab === "settings" && <SettingsView settings={p.settings} setSettings={p.setSettings} onCare={p.onCare} companions={companions} setCompanions={setCompanions} ownId={p.ownId} />}
        {p.tab === "log" && <LogView />}
      </div>
    </div>
  );
}

/* ---------------- Assistant ---------------- */
function Assistant({ onAction, timerStart }: { onAction: () => void; timerStart: (s: number, l?: string) => void }) {
  const [q, setQ] = useState("");
  const [last, setLast] = useState<{ preview: string; needsConfirm: boolean; action: ActionRequest } | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const run = (confirm = false) => {
    const parsed = parseCommand(q);
    const v = parsed.action.type === "unknown" ? { ok: false as const, error: parsed.preview } : validateAction(parsed.action);
    if (!v.ok) {
      const msg = ("error" in v && v.error) ? v.error : parsed.preview;
      setLast({ preview: msg, needsConfirm: false, action: parsed.action });
      setLog((l) => [`Gagal: ${msg}`, ...l].slice(0, 8));
      return;
    }
    if (parsed.needsConfirm && !confirm) {
      setLast({ preview: parsed.preview, needsConfirm: true, action: parsed.action });
      store.audit.push({ id: uid("a"), actionId: actionId(parsed.action), source: "assistant", status: "previewed", confirmationRequired: true, createdAt: new Date().toISOString() });
      return;
    }
    execute(parsed.action, timerStart);
    store.audit.push({ id: uid("a"), actionId: actionId(parsed.action), source: "assistant", status: confirm ? "confirmed" : "executed", confirmationRequired: parsed.needsConfirm, createdAt: new Date().toISOString() });
    setLog((l) => [`OK: ${parsed.preview}`, ...l].slice(0, 8));
    setLast(null); setQ(""); onAction();
  };

  return (
    <div>
      <p className="dp-muted">Proses lokal 100% · tanpa cloud kecuali opt-in. Contoh: “ingatkan deploy jam 4 sore”, “tambah beli susu ke tugas”, “timer 25 menit”.</p>
      <div className="dp-row">
        <input className="dp-in" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") run(); }}
          placeholder="Ketik perintah…" aria-label="Perintah natural" />
        <button className="dp-btn" onClick={() => run()}>Jalan</button>
      </div>
      {last?.needsConfirm && (
        <div className="dp-confirm">
          <div>{last.preview}</div>
          <div className="dp-row"><button className="dp-btn primary" onClick={() => { execute(last.action, timerStart); setLast(null); setQ(""); onAction(); }}>Konfirmasi</button>
          <button className="dp-btn" onClick={() => setLast(null)}>Batal</button></div>
        </div>
      )}
      {last && !last.needsConfirm && <div className="dp-confirm">{last.preview}</div>}
      <div className="dp-log">{log.map((l, i) => <div key={i}>{l}</div>)}</div>
    </div>
  );
}

function actionId(a: ActionRequest): string {
  return a.type === "unknown" ? "unknown" : a.type;
}

export function execute(a: ActionRequest, timerStart: (s: number, l?: string) => void): void {
  const t = new Date().toISOString();
  if (a.type === "reminder.create") {
    const all = store.reminders.all();
    all.unshift({ id: uid("r"), title: a.title, dueAt: a.dueAt, timezone: a.timezone, recurrence: "none", status: "active", createdAt: t, updatedAt: t });
    store.reminders.save(all);
    toast("Pengingat dibuat", a.title, "success");
  } else if (a.type === "todo.create") {
    const all = store.todos.all();
    all.unshift({ id: uid("t"), title: a.title, status: "open", priority: 0, dueAt: a.dueAt ?? null, createdAt: t, updatedAt: t });
    store.todos.save(all);
    toast("Tugas ditambah", a.title, "success");
  } else if (a.type === "note.create") {
    const all = store.notes.all();
    all.unshift({ id: uid("n"), title: a.title, content: a.content, createdAt: t, updatedAt: t });
    store.notes.save(all);
    toast("Catatan dibuat", a.title, "success");
  } else if (a.type === "timer.start") {
    timerStart(a.durationSeconds, a.label);
  } else if (a.type === "calendar.create") {
    const all = store.events.all();
    all.unshift({ id: uid("e"), title: a.title, startAt: a.startAt, endAt: a.endAt, source: "local", createdAt: t });
    store.events.save(all);
    toast("Acara dibuat", a.title, "success");
  }
}

/* ---------------- Reminders ---------------- */
function Reminders({ bump, rkey, settings }: { bump: () => void; rkey: number; settings: DeskSettings }) {
  const [items, setItems] = useState<Reminder[]>(() => store.reminders.all());
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [rec, setRec] = useState<RecurrenceRule>("none");
  const [showHistory, setShowHistory] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { setItems(store.reminders.all()); }, [rkey]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { upcoming, history } = splitReminders(items);

  const add = () => {
    const due = parseNaturalDateTime(when) ?? (when ? new Date(when) : null);
    if (!title.trim()) { toast("Judul masih kosong", "Isi dulu mau diingatkan apa.", "error"); return; }
    if (!due || Number.isNaN(due.getTime())) { toast("Waktunya belum jelas", "Contoh: besok jam 9 pagi · senin 16:30 · dalam 25 menit.", "error"); return; }
    const t = new Date().toISOString();
    const r: Reminder = { id: uid("r"), title: title.trim(), dueAt: toUTCISOString(due), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta", recurrence: rec, status: "active", createdAt: t, updatedAt: t };
    const all = [r, ...store.reminders.all()];
    store.reminders.save(all); setItems(all); setTitle(""); setWhen(""); setRec("none"); bump();
    toast("Pengingat dibuat", `${r.title} · ${formatDue(r.dueAt)}`, "success");
  };
  const onKeyAdd = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") add(); };

  const mutate = (id: string, fn: (r: Reminder) => Reminder) => {
    const all = store.reminders.all().map((r) => (r.id === id ? fn(r) : r));
    store.reminders.save(all); setItems(all); bump();
  };
  const snooze = (r: Reminder, mins: number) => {
    const d = new Date(Date.now() + mins * 60000);
    mutate(r.id, (x) => ({ ...x, status: "snoozed", snoozeUntil: d.toISOString(), updatedAt: new Date().toISOString() }));
    toast("Pengingat ditunda", `${r.title} · bunyi lagi ${relDue(d.toISOString())}.`, "info");
  };
  const complete = (r: Reminder) => {
    mutate(r.id, (x) => ({ ...x, status: "completed", updatedAt: new Date().toISOString() }));
    toast("Pengingat selesai", r.title, "success");
  };
  const remove = (r: Reminder) => {
    mutate(r.id, (x) => ({ ...x, status: "dismissed", updatedAt: new Date().toISOString() }));
  };
  const clearHistory = () => {
    const all = store.reminders.all().filter((r) => r.status === "active" || r.status === "snoozed");
    store.reminders.save(all); setItems(all); bump();
    toast("Riwayat dibersihkan", undefined, "info");
  };

  return (
    <div>
      <div className="dp-muted"><span className="dp-line"><Icon name="bell" size={12} /> Saat waktunya tiba: bubble muncul di atas pet + pet membesar. Klik pet / bubble / toast untuk konfirmasi.</span></div>
      {settings.quietHoursEnabled && <div className="dp-muted"><span className="dp-line"><Icon name="bellOff" size={12} /> Jam sepi {settings.quietStart}:00–{settings.quietEnd}:00 — notifikasi jadi toast sunyi.</span></div>}

      <div className="dp-field">
        <span className="dp-muted">Mau diingatkan apa?</span>
        <input className="dp-in" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={onKeyAdd}
          placeholder="mis. minum obat, jemput adik" aria-label="Judul pengingat" />
      </div>
      <div className="dp-field">
        <span className="dp-muted">Kapan?</span>
        <input className="dp-in" value={when} onChange={(e) => setWhen(e.target.value)} onKeyDown={onKeyAdd}
          placeholder="besok jam 9 pagi · senin 16:30 · dalam 25 menit" aria-label="Waktu pengingat" />
      </div>
      <div className="dp-row">
        <select className="dp-in" value={rec} onChange={(e) => setRec(e.target.value as RecurrenceRule)} aria-label="Pengulangan">
          <option value="none">Sekali saja</option>
          <option value="daily">Setiap hari</option>
          <option value="weekdays">Senin–Jumat</option>
          <option value="weekly">Setiap minggu</option>
        </select>
        <button className="dp-btn primary" onClick={add} title="Buat pengingat"><Icon name="plus" size={14} /> Tambah</button>
      </div>

      <div className="dp-section-title"><Icon name="bell" size={13} /> Mendatang · {upcoming.length}</div>
      <div className="dp-list">
        {upcoming.map((r) => {
          const dueIso = r.snoozeUntil ?? r.dueAt;
          const badge = reminderBadge(r, now);
          return (
            <div key={r.id} className="dp-item">
              <div>
                <b>{r.title}</b>
                <div className="dp-muted"><span className="dp-line"><Icon name="clock" size={11} /> {formatDue(dueIso)} · {relDue(dueIso, now)}</span></div>
                <div className="dp-badges">
                  <span className={`dp-badge${badge.warn ? " warn" : ""}`}>{badge.warn ? <Icon name="bell" size={11} /> : <Icon name="check" size={11} />}{badge.text}</span>
                  {r.recurrence !== "none" && <span className="dp-badge dim"><Icon name="rotate" size={11} />{recurrenceLabel(r.recurrence)}</span>}
                </div>
              </div>
              <div className="dp-row">
                <button className="dp-btn sm" onClick={() => snooze(r, 10)} title="Tunda 10 menit"><Icon name="history" size={13} /> 10 mnt</button>
                <button className="dp-btn sm" onClick={() => complete(r)} title="Tandai selesai"><Icon name="check" size={13} /></button>
                <button className="dp-btn sm" onClick={() => remove(r)} title="Hapus pengingat"><Icon name="trash" size={13} /></button>
              </div>
            </div>
          );
        })}
        {upcoming.length === 0 && <div className="dp-muted"><span className="dp-line"><Icon name="checkCircle" size={12} /> Semua aman — belum ada pengingat mendatang.</span></div>}
      </div>

      {history.length > 0 && (
        <>
          <button className="dp-btn sm" onClick={() => setShowHistory((v) => !v)} title="Tampilkan riwayat"
            aria-expanded={showHistory} style={{ marginTop: 8 }}>
            <Icon name="history" size={13} /> Riwayat ({history.length}) <Icon name="chevronDown" size={13} />
          </button>
          {showHistory && (
            <div className="dp-list" style={{ marginTop: 6 }}>
              {history.map((r) => (
                <div key={r.id} className="dp-item">
                  <div>
                    <b style={{ textDecoration: "line-through" }}>{r.title}</b>
                    <div className="dp-muted">{r.status === "completed" ? "Selesai" : "Dihapus"} · {formatDue(r.updatedAt)}</div>
                  </div>
                  <div className="dp-row">
                    <button className="dp-btn sm" onClick={() => mutate(r.id, (x) => ({ ...x, status: "active", snoozeUntil: null, updatedAt: new Date().toISOString() }))} title="Aktifkan lagi">
                      <Icon name="rotate" size={13} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="dp-row">
                <button className="dp-btn sm" onClick={clearHistory} title="Hapus semua riwayat permanen"><Icon name="trash" size={13} /> Bersihkan riwayat</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- Tasks ---------------- */
function Tasks({ bump, rkey }: { bump: () => void; rkey: number }) {
  const [items, setItems] = useState<Todo[]>(() => store.todos.all());
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "completed" | "today">("all");
  const [q, setQ] = useState("");
  useEffect(() => { setItems(store.todos.all()); }, [rkey]);

  const add = () => {
    if (!title.trim()) return;
    const t = new Date().toISOString();
    const all = [{ id: uid("t"), title: title.trim(), status: "open" as const, priority: 0, createdAt: t, updatedAt: t }, ...store.todos.all()];
    store.todos.save(all); setItems(all); setTitle(""); bump();
  };
  const mutate = (id: string, fn: (x: Todo) => Todo) => {
    const all = store.todos.all().map((x) => (x.id === id ? fn(x) : x));
    store.todos.save(all); setItems(all); bump();
  };
  const remove = (id: string) => {
    const all = store.todos.all().filter((x) => x.id !== id);
    store.todos.save(all); setItems(all); bump(); toast("Tugas dihapus", undefined, "info");
  };

  const shown = useMemo(() => {
    let v = items;
    if (filter === "open") v = v.filter((x) => x.status !== "completed");
    if (filter === "completed") v = v.filter((x) => x.status === "completed");
    if (filter === "today") v = v.filter((x) => x.dueAt && new Date(x.dueAt).toDateString() === new Date().toDateString());
    if (q.trim()) v = v.filter((x) => (x.title + (x.description ?? "")).toLowerCase().includes(q.toLowerCase()));
    return v;
  }, [items, filter, q]);

  return (
    <div>
      <div className="dp-row">
        <input className="dp-in" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Tugas baru…" aria-label="Tugas baru" />
        <button className="dp-btn primary" onClick={add} title="Tambah tugas"><Icon name="plus" size={14} /></button>
      </div>
      <div className="dp-row">
        <input className="dp-in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari…" aria-label="Cari tugas" />
        <select className="dp-in" value={filter} onChange={(e) => setFilter(e.target.value as never)} aria-label="Filter">
          <option value="all">semua</option><option value="open">terbuka</option><option value="today">hari ini</option><option value="completed">selesai</option>
        </select>
      </div>
      <div className="dp-list">{shown.map((x) => (
        <div key={x.id} className="dp-item">
          <div><b style={{ textDecoration: x.status === "completed" ? "line-through" : "none" }}>{x.title}</b>
            {x.dueAt && <div className="dp-muted">{formatDue(x.dueAt)}</div>}</div>
          <div className="dp-row">
            <button className="dp-btn sm" title={x.status === "completed" ? "Buka lagi" : "Tandai selesai"} onClick={() => mutate(x.id, (v) => ({ ...v, status: v.status === "completed" ? "open" : "completed", completedAt: v.status === "completed" ? null : new Date().toISOString(), updatedAt: new Date().toISOString() }))}>{x.status === "completed" ? <Icon name="rotate" size={13} /> : <Icon name="check" size={13} />}</button>
            <button className="dp-btn sm" title="Hapus tugas" onClick={() => remove(x.id)}><Icon name="trash" size={13} /></button>
          </div>
        </div>
      ))}{shown.length === 0 && <div className="dp-muted">Tidak ada tugas.</div>}</div>
    </div>
  );
}

/* ---------------- Notes ---------------- */
function Notes({ bump, rkey }: { bump: () => void; rkey: number }) {
  const [items, setItems] = useState<Note[]>(() => store.notes.all());
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setItems(store.notes.all()); }, [rkey]);

  const active = items.find((n) => n.id === sel && !n.deletedAt) ?? null;
  useEffect(() => { setDraft(active?.content ?? ""); }, [sel]); // eslint-disable-line

  const create = () => {
    const t = new Date().toISOString();
    const n: Note = { id: uid("n"), title: "Catatan baru", content: "", createdAt: t, updatedAt: t };
    const all = [n, ...store.notes.all()];
    store.notes.save(all); setItems(all); setSel(n.id); bump();
  };
  const onEdit = (v: string) => {
    setDraft(v); setSaved("mengetik…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!sel) return;
      const all = store.notes.all().map((n) => (n.id === sel ? { ...n, content: v, title: v.split("\n")[0].slice(0, 60) || "Catatan", updatedAt: new Date().toISOString() } : n));
      store.notes.save(all); setItems(all); setSaved("tersimpan"); bump();
    }, 600);
  };
  const softDelete = (id: string) => {
    const all = store.notes.all().map((n) => (n.id === id ? { ...n, deletedAt: new Date().toISOString() } : n));
    store.notes.save(all); setItems(all); setSel(null); bump();
  };
  const shown = items.filter((n) => !n.deletedAt && (!q.trim() || (n.title + n.content).toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="dp-notes">
      <div className="dp-row">
        <input className="dp-in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari catatan…" aria-label="Cari catatan" />
        <button className="dp-btn primary" onClick={create} title="Buat catatan"><Icon name="plus" size={14} /></button>
      </div>
      <div className="dp-notes-grid">
        <div className="dp-list">{shown.map((n) => (
          <button key={n.id} className={`dp-item clickable${sel === n.id ? " sel" : ""}`} onClick={() => setSel(n.id)}>
            <b>{n.title || "Tanpa judul"}</b><div className="dp-muted">{new Date(n.updatedAt).toLocaleString("id-ID")}</div>
          </button>
        ))}{shown.length === 0 && <div className="dp-muted">Belum ada catatan.</div>}</div>
        <div>
          {active ? (<>
            <textarea className="dp-area" value={draft} onChange={(e) => onEdit(e.target.value)} placeholder="Tulis…" aria-label="Isi catatan" />
            <div className="dp-row"><span className="dp-muted">{saved}</span>
              <button className="dp-btn sm" onClick={() => softDelete(active.id)} title="Hapus catatan"><Icon name="trash" size={13} /> Hapus</button></div>
            <div className="dp-muted">Isi catatan tidak pernah dikirim ke AI/cloud otomatis.</div>
          </>) : <div className="dp-muted">Pilih / buat catatan.</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Timer ---------------- */
function TimerView({ timerStart, timerLeft, settings, setSettings }: {
  timerStart: (s: number, l?: string) => void; timerLeft: number | null;
  settings: DeskSettings; setSettings: (s: DeskSettings) => void;
}) {
  const [txt, setTxt] = useState("25 menit");
  const upd = (patch: Partial<DeskSettings>) => {
    const next = { ...settings, ...patch, telemetryEnabled: false as const };
    saveSettings(next); setSettings(next);
  };
  const start = () => {
    const s = parseDurationSeconds(txt);
    if (s === null) { toast("Durasi tidak valid", "Coba '25 menit' / '1 jam'.", "error"); return; }
    timerStart(s, "Fokus");
  };
  const mm = timerLeft !== null ? Math.floor(timerLeft / 60) : null;
  const ss = timerLeft !== null ? timerLeft % 60 : null;
  return (
    <div>
      <label className="dp-check">
        <input type="checkbox" checked={settings.timerBadgeEnabled ?? true}
          onChange={(e) => upd({ timerBadgeEnabled: e.target.checked })} />
        Tampilkan badge countdown di atas pet
      </label>
      <label className="dp-check">
        <input type="checkbox" checked={settings.timerDoneAlertEnabled ?? true}
          onChange={(e) => upd({ timerDoneAlertEnabled: e.target.checked })} />
        Notifikasi saat timer selesai (toast + pet membesar + suara)
      </label>
      <div className="dp-row"><input className="dp-in" value={txt} onChange={(e) => setTxt(e.target.value)} aria-label="Durasi" />
        <button className="dp-btn primary" onClick={start}>Mulai</button></div>
      <div className="dp-row">
        {[5, 15, 25, 50].map((m) => <button key={m} className="dp-btn sm" onClick={() => timerStart(m * 60, "Fokus")}>{m}m</button>)}
      </div>
      <div className="dp-big">{timerLeft !== null && mm !== null ? `${mm}:${String(ss).padStart(2, "0")}` : "—"}</div>
      {timerLeft !== null && <div className="dp-muted">Timer berjalan.{settings.timerDoneAlertEnabled !== false ? " Selesai → notifikasi + suara." : " Selesai diam-diam (notif mati)."}</div>}
    </div>
  );
}

/* ---------------- Calendar (local + Google stub) ---------------- */
function Calendar({ bump, rkey }: { bump: () => void; rkey: number }) {
  const [items, setItems] = useState<CalEvent[]>(() => store.events.all());
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  useEffect(() => { setItems(store.events.all()); }, [rkey]);
  const add = () => {
    const start = parseNaturalDateTime(when) ?? (when ? new Date(when) : null);
    if (!title.trim() || !start || Number.isNaN(start.getTime())) { toast("Isi judul + waktu valid", undefined, "error"); return; }
    const end = new Date(start.getTime() + 3600000);
    const t = new Date().toISOString();
    const all = [{ id: uid("e"), title: title.trim(), startAt: toUTCISOString(start), endAt: toUTCISOString(end), source: "local" as const, createdAt: t }, ...store.events.all()];
    store.events.save(all); setItems(all); setTitle(""); setWhen(""); bump();
  };
  return (
    <div>
      <div className="dp-warn"><span className="dp-line"><Icon name="info" size={12} /> Google Calendar belum terhubung (opt-in). Kalender lokal di bawah ini 100% offline. Menghubungkan Google butuh OAuth + scope sempit — sengaja belum diaktifkan agar privasi terjaga.</span></div>
      <div className="dp-row"><input className="dp-in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul acara" aria-label="Judul acara" /></div>
      <div className="dp-row"><input className="dp-in" value={when} onChange={(e) => setWhen(e.target.value)} placeholder="senin jam 10" aria-label="Waktu acara" />
        <button className="dp-btn primary" onClick={add} title="Tambah acara"><Icon name="plus" size={14} /></button></div>
      <div className="dp-list">{items.map((e) => (
        <div key={e.id} className="dp-item"><div><b>{e.title}</b><div className="dp-muted">{formatDue(e.startAt)} · {e.source}</div></div>
          <button className="dp-btn sm" title="Hapus acara" onClick={() => { const all = store.events.all().filter((x) => x.id !== e.id); store.events.save(all); setItems(all); bump(); }}><Icon name="trash" size={13} /></button></div>
      ))}{items.length === 0 && <div className="dp-muted">Belum ada acara.</div>}</div>
    </div>
  );
}

/* ---------------- Automations ---------------- */
function Automations({ bump, rkey }: { bump: () => void; rkey: number }) {
  const [items, setItems] = useState<Automation[]>(() => store.automations.all());
  useEffect(() => { setItems(store.automations.all()); }, [rkey]);
  const toggle = (id: string) => {
    const all = store.automations.all().map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a));
    store.automations.save(all); setItems(all); bump();
  };
  return (
    <div>
      <div className="dp-muted">Model trigger/aksi terbatas + konfirmasi untuk tulis eksternal. Log eksekusi tanpa payload sensitif.</div>
      <div className="dp-list">{items.map((a) => (
        <div key={a.id} className="dp-item"><div><b>{a.name}</b><div className="dp-muted">{a.summary}</div>
          {a.lastRunAt && <div className="dp-muted">terakhir: {new Date(a.lastRunAt).toLocaleString("id-ID")}</div>}</div>
          <button className={`dp-btn sm${a.enabled ? " primary" : ""}`} onClick={() => toggle(a.id)}>{a.enabled ? "on" : "off"}</button></div>
      ))}</div>
    </div>
  );
}

/* ---------------- Kondisi pet (Tamagotchi-lite) ---------------- */
function CareView({ settings, onCare }: { settings: DeskSettings; onCare?: (kind: "feed" | "play") => void }) {
  const st = settings.petStats ?? { hunger: 100, mood: 100, energy: 100, updatedAt: "" };
  const bar = (label: string, v: number) => (
    <div className="dp-row" style={{ alignItems: "center" }}>
      <span className="dp-muted" style={{ minWidth: 52, fontSize: 12 }}>{label}</span>
      <div className="dp-bar" role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`dp-bar-fill${v < 25 ? " low" : ""}`} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
      </div>
      <span className="dp-muted" style={{ fontSize: 12, minWidth: 34 }}>{Math.round(v)}</span>
    </div>
  );
  return (
    <div className="dp-field" style={{ marginTop: 4 }}>
      <span className="dp-muted">Kondisi pet</span>
      {bar("Kenyang", st.hunger)}
      {bar("Mood", st.mood)}
      {bar("Energi", st.energy)}
      {onCare && (
        <div className="dp-row" style={{ marginTop: 4 }}>
          <button className="dp-btn sm" onClick={() => onCare("feed")} title="Kenyang 100%">🍗 Makan</button>
          <button className="dp-btn sm" onClick={() => onCare("play")} title="Mood 100%">🎾 Main</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Topi (unlock via elusan) ---------------- */
function HatView({ settings, upd }: { settings: DeskSettings; upd: (patch: Partial<DeskSettings>) => void }) {
  const total = settings.pettingTotal ?? 0;
  const open = unlockedHats(total);
  const openIds = new Set(open.map((h) => h.id));
  return (
    <div className="dp-field" style={{ marginTop: 4 }}>
      <span className="dp-muted">Topi · {total} elusan</span>
      <div className="dp-swatches" role="radiogroup" aria-label="Topi">
        {HATS.map((h) => {
          const unlocked = openIds.has(h.id);
          const active = (settings.activeHat || "none") === h.id;
          return (
            <button
              key={h.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!unlocked}
              title={unlocked ? h.name : `${h.name} · 🔒 ${h.unlockPets} elusan`}
              className={`dp-swatch${active ? " on" : ""}`}
              onClick={() => upd({ activeHat: h.id })}
              style={{ fontSize: 16 }}
            >
              {unlocked ? (h.emoji || "🚫") : "🔒"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Kawan desktop (multi-pet, 1 window per karakter) ---------------- */
/** Patch ganti spesies: nama ikut diperbarui hanya bila masih nama default lama. */
function speciesPatch(cur: Companion, species: PetSpecies): Partial<Companion> {
  return cur.name === defaultNameFor(cur.species, cur.id)
    ? { species, name: defaultNameFor(species, cur.id) }
    : { species };
}
function CompanionsView({ companions, setCompanions }: { companions: Companion[]; setCompanions: (c: Companion[]) => void }) {
  const [form, setForm] = useState<{ species: PetSpecies; paletteId: string; role: CompanionRole }>({ species: "cat", paletteId: "peach", role: "all" });
  const list = normalizeCompanionList(companions.length > 0 ? companions : loadCompanions());
  // Multi-window hanya ada di aplikasi desktop (Tauri). Di preview web / test,
  // daftar tetap tersimpan tapi window baru tidak bisa dibuka.
  const isDesktop = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const notifyChanged = () => {
    try {
      void Promise.resolve(emit("deskpet://companions-changed", "changed")).catch(() => { /* preview */ });
    } catch { /* preview */ }
  };

  const doAdd = async () => {
    if (list.length >= MAX_COMPANIONS) { toast("Maksimal tercapai", `Maksimal ${MAX_COMPANIONS} karakter (hemat performa).`, "error"); return; }
    const added = addCompanion({ species: form.species, paletteId: form.paletteId, role: form.role });
    if (!added) { toast("Gagal menambah", "Coba lagi.", "error"); return; }
    const next = loadCompanions();
    setCompanions(next);
    notifyChanged();
    if (!isDesktop) {
      toast("Tersimpan di daftar", "Mode preview web tidak bisa membuka window baru. Jalankan aplikasi desktop (npm run tauri dev) agar tiap karakter tampil di window-nya.", "info");
      return;
    }
    try {
      await invoke("companions_spawn", { id: added.id });
    } catch (e) {
      toast("Window gagal dibuka", `Karakter tersimpan, tapi window gagal dibuka (${e instanceof Error ? e.message : String(e)}). Coba lagi via tombol kaca pembesar di kartunya.`, "error");
      return;
    }
    toast(`${added.name} bergabung`, "Window baru terbuka untuk karakter ini.", "success");
  };

  const doShow = async (id: string) => {
    if (!isDesktop) {
      toast("Preview web", "Multi-window hanya jalan di aplikasi desktop.", "info");
      return;
    }
    try {
      await invoke("companions_spawn", { id });
    } catch (e) {
      toast("Gagal membuka window", e instanceof Error ? e.message : String(e), "error");
    }
  };

  const doRemove = async (id: string) => {
    try { await invoke("companions_despawn", { id }); } catch { /* lanjut hapus data */ }
    setCompanions(removeCompanion(id));
    notifyChanged();
  };

  const doPatch = (id: string, patch: Partial<Companion>) => {
    setCompanions(updateCompanion(id, patch));
    notifyChanged();
  };

  const doRole = (id: string, role: CompanionRole) => doPatch(id, { role });

  const doSpecies = (id: string, species: PetSpecies) => {
    const cur = list.find((c) => c.id === id);
    doPatch(id, cur ? speciesPatch(cur, species) : { species });
  };

  return (
    <div className="dp-field" style={{ marginTop: 4 }} data-testid="companions-field">
      <span className="dp-muted">Kawan desktop · {list.length}/{MAX_COMPANIONS}</span>
      <div className="dp-muted" style={{ fontSize: 12 }}>Tiap karakter jalan di window-nya sendiri + punya tugas (role) sendiri.</div>
      {!isDesktop && (
        <div className="dp-muted" style={{ fontSize: 12 }}>Mode preview web: daftar tersimpan, tapi window baru hanya terbuka di aplikasi desktop.</div>
      )}
      <div className="dp-comp-list" data-testid="companions-list">
        {list.map((c) => {
          const sp = PET_SPECIES.find((s) => s.id === c.species);
          const pal = CAT_PALETTES.find((p) => p.id === c.paletteId);
          const isMain = c.id === MAIN_COMPANION_ID;
          return (
            <div key={c.id} className="dp-comp-card" data-testid={`companion-${c.id}`}>
              <div className="dp-comp-head">
                <span className="dp-comp-dot" aria-hidden="true" style={{ background: pal?.bodyMain ?? "#8E82EB" }} />
                <div className="dp-comp-title">
                  <b>{c.name}</b>
                  <div className="dp-muted" style={{ fontSize: 12 }}>{sp?.icon} {sp?.name} · {pal?.name ?? c.paletteId}{isMain ? " · utama" : ""}</div>
                </div>
                {!isMain && (
                  <div className="dp-comp-actions">
                    <button className="dp-btn sm dp-icon-btn" onClick={() => void doShow(c.id)} title={`Buka/fokuskan window ${c.name}`} aria-label={`Tampilkan ${c.name}`}><Icon name="zoomIn" size={13} /></button>
                    <button className="dp-btn sm dp-icon-btn danger" onClick={() => void doRemove(c.id)} title={`Tutup window + hapus ${c.name}`} aria-label={`Hapus ${c.name}`}><Icon name="trash" size={13} /></button>
                  </div>
                )}
              </div>
              <div className="dp-comp-grid">
                <label className="dp-comp-label">Spesies
                  <select className="dp-in" aria-label={`Spesies ${c.name}`}
                    value={c.species} onChange={(e) => doSpecies(c.id, e.target.value as PetSpecies)}>
                    {PET_SPECIES.map((s) => (
                      <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                    ))}
                  </select>
                </label>
                <label className="dp-comp-label">Tugas
                  <select className="dp-in" aria-label={`Tugas ${c.name}`}
                    value={c.role} onChange={(e) => doRole(c.id, e.target.value as CompanionRole)}>
                    {COMPANION_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </label>
                <label className="dp-comp-label">Warna
                  <select className="dp-in" aria-label={`Warna ${c.name}`}
                    title="Warna karakter ini"
                    value={CAT_PALETTES.some((p) => p.id === c.paletteId) ? c.paletteId : "custom"}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "custom") return; // custom via Pengaturan → Warna custom
                      doPatch(c.id, { paletteId: v, customColor: "" });
                    }}>
                    {CAT_PALETTES.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    {!CAT_PALETTES.some((p) => p.id === c.paletteId) && (
                      <option value="custom">Custom {c.customColor}</option>
                    )}
                  </select>
                </label>
              </div>
              <div className="dp-comp-toggles">
                <label className="dp-check" title="Tampilkan pill suhu di pet ini">
                  <input type="checkbox" checked={c.showTemp !== false}
                    onChange={(e) => doPatch(c.id, { showTemp: e.target.checked })} /> Suhu
                </label>
                <label className="dp-check" title="Tampilkan pill countdown sholat di pet ini">
                  <input type="checkbox" checked={c.showMini !== false}
                    onChange={(e) => doPatch(c.id, { showMini: e.target.checked })} /> Mini
                </label>
              </div>
            </div>
          );
        })}
      </div>
      {list.length < MAX_COMPANIONS && (
        <div className="dp-comp-add">
          <label className="dp-comp-label">Karakter
            <select className="dp-in" aria-label="Spesies baru"
              value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value as PetSpecies })}>
              {PET_SPECIES.map((s) => (
                <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
              ))}
            </select>
          </label>
          <label className="dp-comp-label">Warna
            <select className="dp-in" aria-label="Warna baru"
              value={form.paletteId} onChange={(e) => setForm({ ...form, paletteId: e.target.value })}>
              {CAT_PALETTES.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="dp-comp-label">Tugas
            <select className="dp-in" aria-label="Tugas baru"
              value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as CompanionRole })}>
              {COMPANION_ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
          <div className="dp-comp-add-btn">
            <button className="dp-btn sm primary" style={{ width: "100%" }} onClick={() => void doAdd()} title="Tambah karakter (window baru)">+ Tambah</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Settings ---------------- */
function SettingsView({ settings, setSettings, onCare, companions, setCompanions, ownId }: { settings: DeskSettings; setSettings: (s: DeskSettings) => void; onCare?: (kind: "feed" | "play") => void; companions: Companion[]; setCompanions: (c: Companion[]) => void; ownId?: string }) {
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const upd = (patch: Partial<DeskSettings>) => {
    const next = { ...settings, ...patch, telemetryEnabled: false as const };
    saveSettings(next); setSettings(next);
    setSavedAt(new Date().toLocaleTimeString("id-ID"));
  };
  const [voices, setVoices] = useState<{ name: string; lang: string }[]>([]);
  useEffect(() => { setVoices(availableVoices()); const t = setTimeout(() => setVoices(availableVoices()), 800); return () => clearTimeout(t); }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  // Pengaturan karakter/warna di sini milik companion PEMILIK WINDOW ini
  // (panel dibuka via double-click pet itu). Window pet merender companion
  // (me.paletteId ?? settings.petPaletteId), jadi tanpa sync ini ganti
  // warna/spesies tidak terlihat karena companion membayangi settings.
  const target = companions.find((c) => c.id === (ownId ?? MAIN_COMPANION_ID))
    ?? companions.find((c) => c.id === MAIN_COMPANION_ID)
    ?? companions[0];
  const syncTarget = (patch: Partial<Companion>) => {
    if (!target) return;
    setCompanions(updateCompanion(target.id, patch));
    try {
      void Promise.resolve(emit("deskpet://companions-changed", "changed")).catch(() => { /* preview */ });
    } catch { /* preview */ }
  };

  const doExport = () => {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `deskpet-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const doImport = async (f: File) => {
    const txt = await f.text();
    const r = importBackup(txt);
    toast(r.ok ? "Backup dipulihkan" : "Gagal impor", r.error, r.ok ? "success" : "error");
  };

  return (
    <div className="dp-settings">
      <label className="dp-check"><input type="checkbox" checked={settings.wanderEnabled} onChange={(e) => upd({ wanderEnabled: e.target.checked })} /> Jalan otomatis (walk)</label>
      <label className="dp-check"><input type="checkbox" checked={settings.centerOnAlert !== false} onChange={(e) => upd({ centerOnAlert: e.target.checked })} /> Kembali ke tengah layar saat alert penting</label>
      <AutostartView settings={settings} upd={upd} />
      {settings.wanderEnabled && (
        <div style={{ marginLeft: 22, marginTop: -2, marginBottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="dp-row" style={{ alignItems: "center", margin: 0 }}>
            <label htmlFor="dp-wander-pace" style={{ minWidth: 90, fontSize: 12 }} className="dp-muted">
              Kecepatan:
            </label>
            <select
              id="dp-wander-pace"
              className="dp-in"
              style={{ padding: "4px 8px", fontSize: 12 }}
              value={settings.wanderPace ?? "random"}
              onChange={(e) => upd({ wanderPace: e.target.value as WanderPace })}
            >
              <option value="random">Acak (Lari / Santai)</option>
              <option value="slow">Santai / Pelan Saja</option>
              <option value="fast">Lari (Sprint Cepat)</option>
              <option value="normal">Normal</option>
            </select>
          </div>
          <div className="dp-row" style={{ alignItems: "center", margin: 0 }}>
            <label htmlFor="dp-wander-dir" style={{ minWidth: 90, fontSize: 12 }} className="dp-muted">
              Arah jelajah:
            </label>
            <select
              id="dp-wander-dir"
              className="dp-in"
              style={{ padding: "4px 8px", fontSize: 12 }}
              value={settings.wanderDirection ?? "random"}
              onChange={(e) => upd({ wanderDirection: e.target.value as WanderDirection })}
            >
              <option value="random">Acak (Semua Arah)</option>
              <option value="horizontal">Kiri – Kanan (Patroli)</option>
              <option value="vertical">Atas – Bawah</option>
              <option value="edges">Pinggir (Keliling Tepi Layar)</option>
            </select>
          </div>
        </div>
      )}
      <div className="dp-row" style={{ alignItems: "center" }}>
        <label htmlFor="dp-species" style={{ minWidth: 110 }}>Karakter {target ? target.name : "pet"} (window ini)</label>
        <select
          id="dp-species"
          className="dp-in"
          style={{ flex: 1, padding: "4px 8px" }}
          value={target?.species ?? settings.petSpecies ?? "cat"}
          onChange={(e) => { const v = e.target.value as PetSpecies; upd({ petSpecies: v }); if (target) syncTarget(speciesPatch(target, v)); }}
        >
          {PET_SPECIES.map((s) => (
            <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
          ))}
        </select>
      </div>
      <div className="dp-field" style={{ marginTop: 2 }}>
        <span className="dp-muted">Warna {target ? target.name : "karakter"} (window ini · lainnya via daftar Kawan di bawah)</span>
          <div className="dp-swatches" role="radiogroup" aria-label="Warna karakter">
            {CAT_PALETTES.map((pal) => {
              const active = (target?.paletteId ?? settings.petPaletteId ?? "lavender") === pal.id;
              return (
                <button
                  key={pal.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={pal.name}
                  className={`dp-swatch${active ? " on" : ""}`}
                  style={{ background: pal.bodyMain }}
                  onClick={() => { upd({ petPaletteId: pal.id, petCustomColor: "" }); syncTarget({ paletteId: pal.id, customColor: "" }); }}
                >
                  <span className="dp-swatch-dot" style={{ background: pal.bodyLight }} />
                </button>
              );
            })}
            <label
              className={`dp-swatch custom${(target?.paletteId ?? settings.petPaletteId) === CUSTOM_PALETTE_ID ? " on" : ""}`}
              title="Warna custom"
              style={{ background: (target ? target.customColor : settings.petCustomColor) || "#8E82EB" }}
            >
              <input
                type="color"
                aria-label="Warna custom"
                value={/^#[0-9a-fA-F]{6}$/.test((target ? target.customColor : settings.petCustomColor) || "") ? (target ? target.customColor : settings.petCustomColor) as string : "#8E82EB"}
                onChange={(e) => { upd({ petPaletteId: CUSTOM_PALETTE_ID, petCustomColor: e.target.value }); syncTarget({ paletteId: CUSTOM_PALETTE_ID, customColor: e.target.value }); }}
                style={{ opacity: 0, width: "100%", height: "100%", cursor: "pointer", position: "absolute", inset: 0 }}
              />
              <span aria-hidden="true" style={{ fontSize: 12 }}>🎨</span>
            </label>
          </div>
          <div className="dp-row" style={{ marginTop: 4 }}>
            <span className="dp-muted" style={{ fontSize: 12 }}>
              {(target?.paletteId ?? settings.petPaletteId) === CUSTOM_PALETTE_ID
                ? `Custom ${(target ? target.customColor : settings.petCustomColor) || "—"} · shading dibuat otomatis`
                : `${CAT_PALETTES.find((x) => x.id === (target?.paletteId ?? settings.petPaletteId ?? "lavender"))?.name ?? "Lavender"} · mata & detail tidak berubah`}
            </span>
            {(target?.paletteId ?? settings.petPaletteId) !== "lavender" && (
              <button className="dp-btn sm" onClick={() => { upd({ petPaletteId: "lavender", petCustomColor: "" }); syncTarget({ paletteId: "lavender", customColor: "" }); }}>Reset</button>
            )}
          </div>
        </div>
      <CareView settings={settings} onCare={onCare} />
      <CompanionsView companions={companions} setCompanions={setCompanions} />
      <HatView settings={settings} upd={upd} />
      <div className="dp-row" style={{ alignItems: "center" }}>
        <label htmlFor="dp-scale" style={{ minWidth: 110 }}>Ukuran pet {Math.round((settings.petScale ?? 1) * 100)}%</label>
        <input id="dp-scale" type="range" min={0.5} max={2} step={0.1}
          value={settings.petScale ?? 1}
          onChange={(e) => upd({ petScale: Math.min(2, Math.max(0.5, Number(e.target.value))) })}
          aria-label="Ukuran pet" style={{ flex: 1 }} />
        <button className="dp-btn sm" onClick={() => upd({ petScale: 1 })}>Reset</button>
      </div>
      <label className="dp-check"><input type="checkbox" checked={settings.alwaysOnTop} onChange={(e) => upd({ alwaysOnTop: e.target.checked })} /> Selalu di atas</label>
      <label className="dp-check"><input type="checkbox" checked={settings.reducedMotion} onChange={(e) => upd({ reducedMotion: e.target.checked })} /> Gerakan tenang (reduced motion)</label>
      <label className="dp-check"><input type="checkbox" checked={settings.speechMuted} onChange={(e) => { upd({ speechMuted: e.target.checked }); if (e.target.checked) stopSpeech(); }} /> Bisukan suara (TTS)</label>
      <label className="dp-check"><input type="checkbox" checked={settings.soundMuted} onChange={(e) => upd({ soundMuted: e.target.checked })} /> Bisukan bunyi</label>
      <label className="dp-check"><input type="checkbox" checked={settings.quietHoursEnabled} onChange={(e) => upd({ quietHoursEnabled: e.target.checked })} /> Quiet hours ({settings.quietStart}:00–{settings.quietEnd}:00)</label>
      <div className="dp-row">
        <label>TTS: {ttsSupported() ? `${voices.length} suara` : "tidak didukung"}</label>
        <button className="dp-btn sm" onClick={() => speak("Halo, saya DeskPet.", { muted: settings.speechMuted })}>Uji suara</button>
        <button className="dp-btn sm" onClick={stopSpeech}>Stop</button>
      </div>
      <div className="dp-row"><button className="dp-btn sm" onClick={doExport}><Icon name="download" size={13} /> Backup</button>
        <button className="dp-btn sm" onClick={() => fileRef.current?.click()}><Icon name="upload" size={13} /> Restore</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); }} /></div>
      {savedAt && <div className="dp-muted" data-testid="settings-saved"><span className="dp-line"><Icon name="check" size={12} /> Tersimpan {savedAt} (lokal, tanpa cloud)</span></div>}
      <div className="dp-muted"><span className="dp-line"><Icon name="check" size={12} /> Local-first · telemetry OFF permanen · Gmail/Google opt-in (belum terhubung) · log aktivitas ada di tab Log.</span></div>
    </div>
  );
}

/* ---------------- Log (audit lokal) ---------------- */
function LogView() {
  const [items, setItems] = useState(() => store.audit.all().slice(0, 50));
  const clear = () => {
    store.audit.clear();
    setItems([]);
    toast("Log dihapus", "Audit lokal dikosongkan.", "info");
  };
  return (
    <div>
      <div className="dp-muted">Catatan aksi & akses eksternal (metadata saja, tanpa isi privat). Hanya akses network sungguhan yang dicatat — sajian cache tidak masuk log.</div>
      <div className="dp-row" style={{ alignItems: "center" }}>
        <span className="dp-muted">{items.length} entri</span>
        <button className="dp-btn sm" onClick={clear} disabled={items.length === 0} title="Hapus semua log">
          <Icon name="trash" size={13} /> Hapus
        </button>
      </div>
      <div className="dp-list" data-testid="audit-list">
        {items.map((a) => (
          <div key={a.id} className="dp-item">
            <div><b>{a.actionId}</b>
              <div className="dp-muted">{a.source} · {a.status}{a.confirmationRequired ? " · perlu konfirmasi" : ""} · {new Date(a.createdAt).toLocaleString("id-ID")}</div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="dp-muted">Belum ada aktivitas tercatat.</div>}
      </div>
    </div>
  );
}

/** Scheduler tick: due reminders -> notify + reschedule (dipanggil dari App tiap 5 dtk). */
export function schedulerTick(opts: { settings: DeskSettings; onFired: (r: Reminder) => void }): Reminder[] {
  const fired: Reminder[] = [];
  const all = store.reminders.all();
  let changed = false;
  const now = new Date();
  const quiet = opts.settings.quietHoursEnabled && isQuietHours(now, opts.settings.quietStart, opts.settings.quietEnd);
  for (const r of all) {
    if (r.status === "completed" || r.status === "dismissed") continue;
    const dueStr = r.snoozeUntil ?? r.dueAt;
    const due = new Date(dueStr);
    if (Number.isNaN(due.getTime()) || due > now) continue;
    // Missed handling: fire once, then reschedule or complete
    fired.push(r);
    if (r.recurrence !== "none") {
      const next = nextOccurrence(due, r.recurrence);
      r.dueAt = next ? next.toISOString() : due.toISOString();
      r.snoozeUntil = null; r.lastTriggeredAt = now.toISOString(); r.updatedAt = now.toISOString();
    } else if (r.snoozeUntil) {
      r.snoozeUntil = null; r.status = "active"; r.dueAt = now.toISOString();
      r.lastTriggeredAt = now.toISOString(); r.updatedAt = now.toISOString();
    } else {
      r.status = "completed"; r.lastTriggeredAt = now.toISOString(); r.updatedAt = now.toISOString();
    }
    changed = true;
    void quiet;
  }
  if (changed) store.reminders.save(all);
  return fired;
}
