/** MainPanel: all PRD surfaces in one expandable window (P2–P4 local-first). */
import { useEffect, useMemo, useRef, useState } from "react";
import { parseCommand, validateAction, type ActionRequest } from "../features/assistant/parser";
import { exportBackup, importBackup, loadSettings, saveSettings, store, uid, type Automation, type CalEvent, type DeskSettings, type Note, type Reminder, type Todo, type WanderPace, type WanderDirection } from "../lib/store";
import { formatDue, isQuietHours, nextOccurrence, parseDurationSeconds, parseNaturalDateTime, toUTCISOString } from "../lib/time";
import { permissionState, toast } from "../lib/notify";
import { availableVoices, speak, stopSpeech, ttsSupported } from "../lib/tts";

export type PanelTab = "assistant" | "reminders" | "tasks" | "notes" | "timer" | "calendar" | "auto" | "settings";

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
}

const TABS: { id: PanelTab; label: string }[] = [
  { id: "assistant", label: "💬" }, { id: "reminders", label: "⏰" },
  { id: "tasks", label: "✅" }, { id: "notes", label: "📝" },
  { id: "timer", label: "⏱️" }, { id: "calendar", label: "📅" },
  { id: "auto", label: "⚙️" }, { id: "settings", label: "🔧" },
];

export function MainPanel(p: Props) {
  return (
    <div className="dp-panel" data-testid="main-panel" role="dialog" aria-label="DeskPet panel">
      <div className="dp-panel-head">
        <div className="dp-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={p.tab === t.id}
              className={`dp-tab${p.tab === t.id ? " on" : ""}`}
              onClick={() => p.setTab(t.id)} title={t.id}>{t.label}</button>
          ))}
        </div>
        <button className="dp-x" onClick={p.onClose} title="Tutup (Esc)">✕</button>
      </div>
      <div className="dp-panel-body">
        {p.tab === "assistant" && <Assistant onAction={p.bump} timerStart={p.timerStart} />}
        {p.tab === "reminders" && <Reminders bump={p.bump} rkey={p.refreshKey} settings={p.settings} />}
        {p.tab === "tasks" && <Tasks bump={p.bump} rkey={p.refreshKey} />}
        {p.tab === "notes" && <Notes bump={p.bump} rkey={p.refreshKey} />}
        {p.tab === "timer" && <TimerView timerStart={p.timerStart} timerLeft={p.timerLeft} />}
        {p.tab === "calendar" && <Calendar bump={p.bump} rkey={p.refreshKey} />}
        {p.tab === "auto" && <Automations bump={p.bump} rkey={p.refreshKey} />}
        {p.tab === "settings" && <SettingsView settings={p.settings} setSettings={p.setSettings} />}
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
      setLog((l) => [`❓ ${msg}`, ...l].slice(0, 8));
      return;
    }
    if (parsed.needsConfirm && !confirm) {
      setLast({ preview: parsed.preview, needsConfirm: true, action: parsed.action });
      store.audit.push({ id: uid("a"), actionId: actionId(parsed.action), source: "assistant", status: "previewed", confirmationRequired: true, createdAt: new Date().toISOString() });
      return;
    }
    execute(parsed.action, timerStart);
    store.audit.push({ id: uid("a"), actionId: actionId(parsed.action), source: "assistant", status: confirm ? "confirmed" : "executed", confirmationRequired: parsed.needsConfirm, createdAt: new Date().toISOString() });
    setLog((l) => [`✅ ${parsed.preview}`, ...l].slice(0, 8));
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
  const [rec, setRec] = useState<"none" | "daily" | "weekdays" | "weekly">("none");
  useEffect(() => { setItems(store.reminders.all()); }, [rkey]);

  const add = () => {
    const due = parseNaturalDateTime(when) ?? (when ? new Date(when) : null);
    if (!title.trim()) { toast("Judul kosong", undefined, "error"); return; }
    if (!due || Number.isNaN(due.getTime())) { toast("Waktu tidak dikenali. Coba 'besok jam 9 pagi'.", undefined, "error"); return; }
    const t = new Date().toISOString();
    const r: Reminder = { id: uid("r"), title: title.trim(), dueAt: toUTCISOString(due), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta", recurrence: rec, status: "active", createdAt: t, updatedAt: t };
    const all = [r, ...store.reminders.all()];
    store.reminders.save(all); setItems(all); setTitle(""); setWhen(""); bump();
    toast("Pengingat dibuat", `${r.title} · ${formatDue(r.dueAt)}`, "success");
  };

  const mutate = (id: string, fn: (r: Reminder) => Reminder) => {
    const all = store.reminders.all().map((r) => (r.id === id ? fn(r) : r));
    store.reminders.save(all); setItems(all); bump();
  };
  const snooze = (r: Reminder, mins: number) => {
    const d = new Date(Date.now() + mins * 60000);
    mutate(r.id, (x) => ({ ...x, status: "snoozed", snoozeUntil: d.toISOString(), updatedAt: new Date().toISOString() }));
  };

  const perm = permissionState();
  return (
    <div>
      {perm === "denied" && <div className="dp-warn">⚠️ Izin notifikasi ditolak browser/OS — pengingat tetap tersimpan & muncul sebagai toast dalam app.</div>}
      {settings.quietHoursEnabled && <div className="dp-muted">🔕 Quiet hours {settings.quietStart}:00–{settings.quietEnd}:00 — notifikasi ditahan jadi toast sunyi.</div>}
      <div className="dp-row"><input className="dp-in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul pengingat" aria-label="Judul" /></div>
      <div className="dp-row">
        <input className="dp-in" value={when} onChange={(e) => setWhen(e.target.value)} placeholder="besok jam 9 pagi / 16:30" aria-label="Waktu" />
        <select className="dp-in" value={rec} onChange={(e) => setRec(e.target.value as never)} aria-label="Recurrence">
          <option value="none">sekali</option><option value="daily">harian</option><option value="weekdays">weekday</option><option value="weekly">mingguan</option>
        </select>
        <button className="dp-btn primary" onClick={add}>＋</button>
      </div>
      <div className="dp-list">
        {items.filter((r) => r.status !== "completed" && r.status !== "dismissed").map((r) => (
          <div key={r.id} className="dp-item">
            <div><b>{r.title}</b><div className="dp-muted">{formatDue(r.snoozeUntil ?? r.dueAt)} · {r.recurrence} · {r.status}</div></div>
            <div className="dp-row">
              <button className="dp-btn sm" onClick={() => snooze(r, 10)}>＋10m</button>
              <button className="dp-btn sm" onClick={() => mutate(r.id, (x) => ({ ...x, status: "completed", updatedAt: new Date().toISOString() }))}>✓</button>
              <button className="dp-btn sm" onClick={() => mutate(r.id, (x) => ({ ...x, status: "dismissed", updatedAt: new Date().toISOString() }))}>✕</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="dp-muted">Belum ada pengingat.</div>}
      </div>
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
        <button className="dp-btn primary" onClick={add}>＋</button>
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
            <button className="dp-btn sm" onClick={() => mutate(x.id, (v) => ({ ...v, status: v.status === "completed" ? "open" : "completed", completedAt: v.status === "completed" ? null : new Date().toISOString(), updatedAt: new Date().toISOString() }))}>{x.status === "completed" ? "↩" : "✓"}</button>
            <button className="dp-btn sm" onClick={() => remove(x.id)}>✕</button>
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
      store.notes.save(all); setItems(all); setSaved("tersimpan ✓"); bump();
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
        <button className="dp-btn primary" onClick={create}>＋</button>
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
              <button className="dp-btn sm" onClick={() => softDelete(active.id)}>Hapus</button></div>
            <div className="dp-muted">Isi catatan tidak pernah dikirim ke AI/cloud otomatis.</div>
          </>) : <div className="dp-muted">Pilih / buat catatan.</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Timer ---------------- */
function TimerView({ timerStart, timerLeft }: { timerStart: (s: number, l?: string) => void; timerLeft: number | null }) {
  const [txt, setTxt] = useState("25 menit");
  const start = () => {
    const s = parseDurationSeconds(txt);
    if (s === null) { toast("Durasi tidak valid", "Coba '25 menit' / '1 jam'.", "error"); return; }
    timerStart(s, "Fokus");
  };
  const mm = timerLeft !== null ? Math.floor(timerLeft / 60) : null;
  const ss = timerLeft !== null ? timerLeft % 60 : null;
  return (
    <div>
      <div className="dp-row"><input className="dp-in" value={txt} onChange={(e) => setTxt(e.target.value)} aria-label="Durasi" />
        <button className="dp-btn primary" onClick={start}>Mulai</button></div>
      <div className="dp-row">
        {[5, 15, 25, 50].map((m) => <button key={m} className="dp-btn sm" onClick={() => timerStart(m * 60, "Fokus")}>{m}m</button>)}
      </div>
      <div className="dp-big">{timerLeft !== null && mm !== null ? `${mm}:${String(ss).padStart(2, "0")}` : "—"}</div>
      {timerLeft !== null && <div className="dp-muted">Timer berjalan. Selesai → notifikasi + suara.</div>}
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
      <div className="dp-warn">🔌 Google Calendar belum terhubung (opt-in). Kalender lokal di bawah ini 100% offline. Menghubungkan Google butuh OAuth + scope sempit — sengaja belum diaktifkan agar privasi terjaga.</div>
      <div className="dp-row"><input className="dp-in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul acara" aria-label="Judul acara" /></div>
      <div className="dp-row"><input className="dp-in" value={when} onChange={(e) => setWhen(e.target.value)} placeholder="senin jam 10" aria-label="Waktu acara" />
        <button className="dp-btn primary" onClick={add}>＋</button></div>
      <div className="dp-list">{items.map((e) => (
        <div key={e.id} className="dp-item"><div><b>{e.title}</b><div className="dp-muted">{formatDue(e.startAt)} · {e.source}</div></div>
          <button className="dp-btn sm" onClick={() => { const all = store.events.all().filter((x) => x.id !== e.id); store.events.save(all); setItems(all); bump(); }}>✕</button></div>
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

/* ---------------- Settings ---------------- */
function SettingsView({ settings, setSettings }: { settings: DeskSettings; setSettings: (s: DeskSettings) => void }) {
  const upd = (patch: Partial<DeskSettings>) => {
    const next = { ...settings, ...patch, telemetryEnabled: false as const };
    saveSettings(next); setSettings(next);
  };
  const [voices, setVoices] = useState<{ name: string; lang: string }[]>([]);
  useEffect(() => { setVoices(availableVoices()); const t = setTimeout(() => setVoices(availableVoices()), 800); return () => clearTimeout(t); }, []);
  const fileRef = useRef<HTMLInputElement>(null);

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
              <option value="random">🎲 Acak (Lari / Santai)</option>
              <option value="slow">🐢 Santai / Pelan Saja</option>
              <option value="fast">⚡ Lari-Lari (Sprint Cepat)</option>
              <option value="normal">🚶 Normal</option>
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
              <option value="random">🎲 Acak (Semua Arah)</option>
              <option value="horizontal">↔️ Kiri – Kanan (Patroli)</option>
              <option value="vertical">↕️ Atas – Bawah</option>
            </select>
          </div>
        </div>
      )}
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
      <div className="dp-row"><button className="dp-btn sm" onClick={doExport}>⬇ Backup</button>
        <button className="dp-btn sm" onClick={() => fileRef.current?.click()}>⬆ Restore</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); }} /></div>
      <div className="dp-muted">🔒 Local-first · telemetry OFF permanen · Gmail/Google opt-in (belum terhubung) · audit tersimpan lokal ({store.audit.all().length} entri).</div>
      <AuditView />
    </div>
  );
}

function AuditView() {
  const [items] = useState(() => store.audit.all().slice(0, 20));
  if (items.length === 0) return null;
  return (
    <div className="dp-list">
      {items.map((a) => <div key={a.id} className="dp-item"><div><b>{a.actionId}</b><div className="dp-muted">{a.source} · {a.status} · {new Date(a.createdAt).toLocaleString("id-ID")}</div></div></div>)}
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
