/** API Watch: polling generik ke endpoint notifikasi (mis. Laravel).
 * Local-first + opt-in: mati secara default, endpoint & interval dari setting
 * (TIDAK di-hardcode), state cursor `lastSeenId` di localStorage.
 *
 * Kontrak endpoint yang didukung (seperti /api/notif-histories/poll):
 *   GET {baseUrl}                 -> { data: [...], latest_id, count }
 *   GET {baseUrl}?since_id={n}    -> hanya item dengan id > n
 *   item: { id: number, title: string, body: string, ... }
 */
import { loadJSON, saveJSON } from "../../lib/storage";

export interface ApiWatchItem {
  id: number;
  title: string;
  body: string;
  type?: string;
  sentAt?: string;
}

export interface ApiWatchConfig {
  enabled: boolean;
  /** Tanpa trailing slash. Query `?since_id=` ditambah otomatis saat polling. */
  baseUrl: string;
  /** Detik antar polling. Dibatasi MIN_INTERVAL_SECS agar tidak menghajar server. */
  intervalSecs: number;
  /** Cursor: id terbesar yang sudah diproses. null = belum pernah baseline. */
  lastSeenId: number | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  /** Simpan tiap item baru sebagai row di tab Pengingat (selain bubble/toast). */
  saveAsReminder: boolean;
  /** Bacakan judul via TTS saat item baru (hormati quiet-hours + mute). */
  speakNew: boolean;
}

export const APIWATCH_KEY = "deskpet:apiwatch";
export const MIN_INTERVAL_SECS = 30;
export const MAX_INTERVAL_SECS = 3600;
export const FETCH_TIMEOUT_MS = 12_000;

/** Sengaja TANPA default URL: endpoint bisa berubah-ubah, jadi hanya
 *  dibaca dari cache (localStorage) yang diisi user via tab API Watch.
 *  Kosong = belum dikonfigurasi = polling diam (tidak fetch). */
export const DEFAULT_APIWATCH: ApiWatchConfig = {
  enabled: false,
  baseUrl: "",
  intervalSecs: 60,
  lastSeenId: null,
  lastCheckedAt: null,
  lastError: null,
  saveAsReminder: true,
  speakNew: false,
};

/** Validasi + isi default. URL kosong / bukan http(s) -> "" (belum diisi),
 *  bukan fallback ke URL mana pun. */
export function normalizeApiWatch(raw: Partial<ApiWatchConfig>): ApiWatchConfig {
  const t = typeof raw.baseUrl === "string" ? raw.baseUrl.trim().replace(/\/+$/, "") : "";
  const baseUrl = /^https?:\/\/.{3,2000}$/.test(t) ? t : "";
  const intervalSecs = typeof raw.intervalSecs === "number" && Number.isFinite(raw.intervalSecs)
    ? Math.min(MAX_INTERVAL_SECS, Math.max(MIN_INTERVAL_SECS, Math.floor(raw.intervalSecs)))
    : DEFAULT_APIWATCH.intervalSecs;
  const lastSeenId = typeof raw.lastSeenId === "number" && Number.isFinite(raw.lastSeenId) && raw.lastSeenId >= 0
    ? Math.floor(raw.lastSeenId)
    : null;
  return {
    enabled: raw.enabled === true,
    baseUrl,
    intervalSecs,
    lastSeenId,
    lastCheckedAt: typeof raw.lastCheckedAt === "string" ? raw.lastCheckedAt : null,
    lastError: typeof raw.lastError === "string" ? raw.lastError : null,
    saveAsReminder: raw.saveAsReminder !== false,
    speakNew: raw.speakNew === true,
  };
}

export function loadApiWatch(): ApiWatchConfig {
  return normalizeApiWatch(loadJSON<Partial<ApiWatchConfig>>(APIWATCH_KEY, {}));
}

export function saveApiWatch(cfg: ApiWatchConfig): void {
  saveJSON(APIWATCH_KEY, normalizeApiWatch(cfg));
}

/** "https://x/poll" + since 17 -> "https://x/poll?since_id=17" (hormati query bawaan). */
export function buildPollUrl(baseUrl: string, sinceId: number | null): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (sinceId === null) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}since_id=${encodeURIComponent(String(sinceId))}`;
}

export interface ParsedPoll {
  items: ApiWatchItem[];
  latestId: number | null;
  count: number;
}

function toItem(r: unknown): ApiWatchItem | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== "number" || !Number.isFinite(o.id)) return null;
  if (typeof o.title !== "string" || typeof o.body !== "string") return null;
  return {
    id: Math.floor(o.id),
    title: o.title.slice(0, 300),
    body: o.body.slice(0, 4000),
    type: typeof o.type === "string" ? o.type : undefined,
    sentAt: typeof o.sent_at === "string" ? o.sent_at : undefined,
  };
}

/** Murni: ubah JSON mentah -> item valid + cursor. Tak dikenal -> dilewat, tak pernah throw. */
export function parsePollResponse(json: unknown): ParsedPoll {
  try {
    const o = (json ?? {}) as Record<string, unknown>;
    const raw = Array.isArray(o.data) ? o.data : [];
    const items = raw
      .map(toItem)
      .filter((x): x is ApiWatchItem => x !== null)
      .sort((a, b) => a.id - b.id)
      .slice(0, 100);
    const latestId = typeof o.latest_id === "number" && Number.isFinite(o.latest_id)
      ? Math.floor(o.latest_id)
      : (items.length > 0 ? items[items.length - 1].id : null);
    const count = typeof o.count === "number" ? o.count : items.length;
    return { items, latestId, count };
  } catch {
    return { items: [], latestId: null, count: 0 };
  }
}

/** Murni: item yang id-nya lebih besar dari cursor (urut naik). */
export function selectNewItems(parsed: ParsedPoll, lastSeenId: number | null): ApiWatchItem[] {
  if (lastSeenId === null) return [];
  return parsed.items.filter((it) => it.id > lastSeenId);
}

export interface PollOutcome {
  ok: boolean;
  httpStatus: number | null;
  parsed: ParsedPoll;
  error: string | null;
}

async function fetchJSON(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<{ status: number; json: unknown }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    const status = r.status;
    if (!r.ok) return { status, json: null };
    return { status, json: (await r.json()) as unknown };
  } finally {
    clearTimeout(t);
  }
}

/** Satu putaran polling. Tidak pernah throw; offline/HTTP-error/belum
 *  dikonfigurasi -> ok:false. */
export async function fetchPoll(cfg: ApiWatchConfig): Promise<PollOutcome> {
  if (!cfg.baseUrl) {
    return { ok: false, httpStatus: null, parsed: { items: [], latestId: null, count: 0 }, error: "endpoint belum diisi" };
  }
  const url = buildPollUrl(cfg.baseUrl, cfg.lastSeenId);
  try {
    const { status, json } = await fetchJSON(url);
    if (json === null) return { ok: false, httpStatus: status, parsed: { items: [], latestId: null, count: 0 }, error: `HTTP ${status}` };
    return { ok: true, httpStatus: status, parsed: parsePollResponse(json), error: null };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "timeout 12 dtk" : "network offline/gagal";
    return { ok: false, httpStatus: null, parsed: { items: [], latestId: null, count: 0 }, error: msg };
  }
}

export interface TestOutcome {
  ok: boolean;
  httpStatus: number | null;
  count: number;
  latestId: number | null;
  previewTitle: string | null;
  previewBody: string | null;
  error: string | null;
}

/** Uji endpoint dari UI: fetch TANPA since_id, tanpa mengubah cursor tersimpan. */
export async function testEndpoint(baseUrl: string): Promise<TestOutcome> {
  const norm = normalizeApiWatch({ baseUrl });
  if (!norm.baseUrl) {
    return { ok: false, httpStatus: null, count: 0, latestId: null, previewTitle: null, previewBody: null, error: "isi endpoint dulu (harus http(s)://…)" };
  }
  try {
    const { status, json } = await fetchJSON(norm.baseUrl);
    if (json === null) return { ok: false, httpStatus: status, count: 0, latestId: null, previewTitle: null, previewBody: null, error: `HTTP ${status}` };
    const p = parsePollResponse(json);
    const last = p.items.length > 0 ? p.items[p.items.length - 1] : null;
    return {
      ok: true, httpStatus: status, count: p.count, latestId: p.latestId,
      previewTitle: last?.title ?? null, previewBody: last?.body.slice(0, 200) ?? null, error: null,
    };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "timeout 12 dtk" : "network offline/gagal";
    return { ok: false, httpStatus: null, count: 0, latestId: null, previewTitle: null, previewBody: null, error: msg };
  }
}
