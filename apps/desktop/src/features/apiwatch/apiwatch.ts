/** API Watch via ntfy: listen pesan push, bukan polling HTTP.
 * Local-first + opt-in: mati default, cuma butuh nama topic (+opsional server).
 * Backend cukup POST ke topic saat ada notif baru; DeskPet listen SSE:
 *   GET {server}/{topic}/sse   (live, via EventSource)
 *   GET {server}/{topic}/json?poll=1 (sekali, untuk Test koneksi)
 *
 * Format pesan ntfy (per baris/event):
 *   {"id":"...","event":"message","topic":"...","title":"...","message":"...",
 *    "time":1710000000}
 */
import { loadJSON, saveJSON } from "../../lib/storage";

export interface ApiWatchItem {
  /** id pesan ntfy (string acak). */
  key: string;
  title: string;
  body: string;
  ntfyId?: string;
  sentAt?: string;
}

export interface ApiWatchConfig {
  enabled: boolean;
  /** Mis. https://ntfy.sh (tanpa trailing slash). */
  server: string;
  /** Nama topic, mis. contoh-topik. Hanya [A-Za-z0-9_-], maks 64. */
  topic: string;
  /** id pesan terakhir yang sudah diproses (dedupe reconnect). */
  lastMsgId: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  /** Simpan tiap pesan baru sebagai row di tab Pengingat. */
  saveAsReminder: boolean;
  /** Bacakan judul via TTS saat pesan baru (hormati quiet-hours + mute). */
  speakNew: boolean;
}

export const APIWATCH_KEY = "deskpet:apiwatch";
export const DEFAULT_NTFY_SERVER = "https://ntfy.sh";
export const FETCH_TIMEOUT_MS = 12_000;

export const DEFAULT_APIWATCH: ApiWatchConfig = {
  enabled: false,
  server: DEFAULT_NTFY_SERVER,
  topic: "",
  lastMsgId: null,
  lastCheckedAt: null,
  lastError: null,
  saveAsReminder: true,
  speakNew: false,
};

/** Server valid = http(s)://... ; selain itu fallback default. */
export function normalizeServer(raw: unknown): string {
  const t = typeof raw === "string" ? raw.trim().replace(/\/+$/, "") : "";
  return /^https?:\/\/.{3,2000}$/.test(t) ? t : DEFAULT_NTFY_SERVER;
}

/** Topic ntfy valid: 1..64 char [A-Za-z0-9_-]. Selain itu "". */
export function normalizeTopic(raw: unknown): string {
  const t = typeof raw === "string" ? raw.trim() : "";
  return /^[A-Za-z0-9_-]{1,64}$/.test(t) ? t : "";
}

type LegacyConfig = Partial<ApiWatchConfig> & {
  baseUrl?: unknown;
  lastSeenId?: unknown;
  intervalSecs?: unknown;
};

/** Validasi + isi default. Migrasikan config polling lama (baseUrl ntfy) ke topic. */
export function normalizeApiWatch(raw: LegacyConfig): ApiWatchConfig {
  const o = (raw ?? {}) as Record<string, unknown>;
  let topic = normalizeTopic(o.topic);
  if (!topic && typeof o.baseUrl === "string") {
    // Dukung migrasi config polling lama HANYA bila host-nya ntfy:
    // "https://ntfy.sh/topik", ".../topik/sse", ".../topik/json?poll=1".
    // URL API polling lama yang multi-segmen (mis. /api/notif.../poll) sengaja TIDAK
    // dimigrasi agar tidak jadi topic ngawur.
    const m = o.baseUrl.trim().match(/^https?:\/\/[^/]*ntfy[^/]*\/([A-Za-z0-9_-]{1,64})(?:\/(?:sse|json))?\/?(?:[?#].*)?$/);
    if (m) topic = m[1];
  }
  const lastMsgId = typeof o.lastMsgId === "string" && o.lastMsgId.length > 0 && o.lastMsgId.length <= 256
    ? o.lastMsgId
    : null;
  return {
    enabled: o.enabled === true,
    server: normalizeServer(o.server),
    topic,
    lastMsgId,
    lastCheckedAt: typeof o.lastCheckedAt === "string" ? o.lastCheckedAt : null,
    lastError: typeof o.lastError === "string" ? o.lastError : null,
    saveAsReminder: o.saveAsReminder !== false,
    speakNew: o.speakNew === true,
  };
}

export function loadApiWatch(): ApiWatchConfig {
  return normalizeApiWatch(loadJSON<LegacyConfig>(APIWATCH_KEY, {}));
}

export function saveApiWatch(cfg: ApiWatchConfig): void {
  saveJSON(APIWATCH_KEY, normalizeApiWatch(cfg));
}

/** "https://ntfy.sh" + "contoh-topik" -> "https://ntfy.sh/contoh-topik/sse" */
export function ntfySseUrl(server: string, topic: string, sinceId: string | null = null): string {
  const base = `${normalizeServer(server)}/${normalizeTopic(topic)}`;
  if (sinceId) return `${base}/sse?since=${encodeURIComponent(sinceId)}`;
  return `${base}/sse`;
}

/** URL polling sekali (untuk Test): ".../topik/json?poll=1" */
export function ntfyPollUrl(server: string, topic: string): string {
  return `${normalizeServer(server)}/${normalizeTopic(topic)}/json?poll=1`;
}

/** Satu event/baris ntfy -> item. Bukan event message -> null. Tak pernah throw. */
export function parseNtfyMessage(raw: unknown): ApiWatchItem | null {
  try {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    if (o.event !== undefined && o.event !== "message") return null;
    if (typeof o.id !== "string" || o.id.length === 0) return null;
    const titleRaw = typeof o.title === "string" ? o.title.trim() : "";
    const msgRaw = typeof o.message === "string" ? o.message : "";
    const topicRaw = typeof o.topic === "string" ? o.topic : "";
    const title = (titleRaw || msgRaw.slice(0, 80).trim() || topicRaw || "(tanpa judul)").slice(0, 300);
    const body = msgRaw.slice(0, 4000);
    const time = typeof o.time === "number" && Number.isFinite(o.time) ? o.time : null;
    return {
      key: o.id,
      title,
      body,
      ntfyId: o.id,
      sentAt: time ? new Date(time * 1000).toISOString() : undefined,
    };
  } catch {
    return null;
  }
}

/** Body NDJSON dari /json?poll=1 -> item pesan (urut waktu, maks 100). */
export function parseNtfyPollText(text: string): ApiWatchItem[] {
  const out: ApiWatchItem[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const it = parseNtfyMessage(JSON.parse(t) as unknown);
      if (it) out.push(it);
    } catch {
      /* baris rusak dilewat */
    }
    if (out.length >= 100) break;
  }
  return out;
}

export interface NtfyCache {
  items: ApiWatchItem[];
  latestMsgId: string | null;
  count: number;
}

export interface TestOutcome {
  ok: boolean;
  httpStatus: number | null;
  count: number;
  latestMsgId: string | null;
  previewTitle: string | null;
  previewBody: string | null;
  error: string | null;
  /** Hasil verifikasi subscribe SSE live (null = belum dicek). */
  sseOk: boolean | null;
  sseError: string | null;
}

async function fetchText(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<{ status: number; text: string | null }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json, text/event-stream" } });
    if (!r.ok) return { status: r.status, text: null };
    return { status: r.status, text: await r.text() };
  } finally {
    clearTimeout(t);
  }
}

/** Ambil pesan cached sekali (untuk Test tombol; bukan loop). Tak pernah throw. */
export async function fetchNtfyCache(cfg: ApiWatchConfig): Promise<{ ok: boolean; httpStatus: number | null; cache: NtfyCache; error: string | null }> {
  if (!cfg.topic) {
    return { ok: false, httpStatus: null, cache: { items: [], latestMsgId: null, count: 0 }, error: "isi topic dulu" };
  }
  try {
    const { status, text } = await fetchText(ntfyPollUrl(cfg.server, cfg.topic));
    if (text === null) return { ok: false, httpStatus: status, cache: { items: [], latestMsgId: null, count: 0 }, error: `HTTP ${status}` };
    const items = parseNtfyPollText(text);
    return {
      ok: true, httpStatus: status,
      cache: { items, latestMsgId: items.length > 0 ? items[items.length - 1].key : null, count: items.length },
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "timeout 12 dtk" : "network offline/gagal";
    return { ok: false, httpStatus: null, cache: { items: [], latestMsgId: null, count: 0 }, error: msg };
  }
}

/** Uji topic dari UI: fetch cache TANPA mengubah lastMsgId tersimpan. */
export async function testNtfy(server: string, topic: string): Promise<TestOutcome> {
  const cfg = normalizeApiWatch({ server, topic });
  if (!cfg.topic) {
    return { ok: false, httpStatus: null, count: 0, latestMsgId: null, previewTitle: null, previewBody: null, error: "isi topic dulu (A-Z a-z 0-9 _ -)", sseOk: null, sseError: null };
  }
  const r = await fetchNtfyCache(cfg);
  if (!r.ok) {
    return { ok: false, httpStatus: r.httpStatus, count: 0, latestMsgId: null, previewTitle: null, previewBody: null, error: r.error, sseOk: null, sseError: null };
  }
  const last = r.cache.items.length > 0 ? r.cache.items[r.cache.items.length - 1] : null;
  return {
    ok: true, httpStatus: r.httpStatus, count: r.cache.count, latestMsgId: r.cache.latestMsgId,
    previewTitle: last?.title ?? null, previewBody: last?.body.slice(0, 200) || null, error: null,
    sseOk: null, sseError: null,
  };
}

/** Verifikasi subscribe SSE live: buka EventSource sebentar, OK bila `open`.
 *  Koneksi langsung ditutup lagi; tak pernah throw. */
export async function testSubscribe(server: string, topic: string, timeoutMs = 10_000): Promise<{ ok: boolean; error: string | null }> {
  const cfg = normalizeApiWatch({ server, topic });
  if (!cfg.topic) return { ok: false, error: "isi topic dulu" };
  if (typeof EventSource === "undefined") return { ok: false, error: "browser tidak dukung EventSource" };
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean, error: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { es?.close(); } catch { /* abaikan */ }
      resolve({ ok, error });
    };
    let es: EventSource | null = null;
    try {
      es = new EventSource(ntfySseUrl(cfg.server, cfg.topic));
    } catch {
      resolve({ ok: false, error: "gagal buka SSE" });
      return;
    }
    const timer = setTimeout(() => finish(false, `timeout ${Math.round(timeoutMs / 1000)} dtk (server/topic tak merespons SSE)`), timeoutMs);
    es.onopen = () => finish(true, null);
    es.onerror = () => finish(false, "SSE ditolak/gagal (cek nama topic + server)");
  });
}

export interface NtfyHandlers {
  onItem: (item: ApiWatchItem) => void;
  onOpen?: () => void;
  onError?: (msg: string) => void;
}

/** Subscribe SSE ke topic. Lanjut dari pesan terakhir (since) bila ada agar
 *  pesan yang terbit saat app mati/putus ikut ke-replay. Kembalikan unsubscribe. */
export function subscribeNtfy(cfg: ApiWatchConfig, handlers: NtfyHandlers): () => void {
  if (typeof EventSource === "undefined") {
    handlers.onError?.("browser tidak dukung EventSource");
    return () => {};
  }
  const url = cfg.lastMsgId
    ? ntfySseUrl(cfg.server, cfg.topic, cfg.lastMsgId)
    : ntfySseUrl(cfg.server, cfg.topic);
  const es = new EventSource(url);
  let closed = false;
  es.onopen = () => { if (!closed) handlers.onOpen?.(); };
  es.onmessage = (ev) => {
    if (closed) return;
    try {
      const item = parseNtfyMessage(JSON.parse((ev as MessageEvent).data as string) as unknown);
      if (item) handlers.onItem(item);
    } catch {
      /* payload rusak dilewat */
    }
  };
  es.onerror = () => { if (!closed) handlers.onError?.("koneksi ntfy terputus (auto-retry)"); };
  return () => { closed = true; es.close(); };
}
