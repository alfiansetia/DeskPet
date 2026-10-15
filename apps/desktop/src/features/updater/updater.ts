/** Cek update manual: fetch file versi di GitHub, bandingkan semver.
 * Manual via tombol saja (local-first): tidak ada polling/background network.
 * File versi: `updates/stable.json` di branch main (lihat repo root).
 */
export const UPDATE_CHECK_URL =
  "https://raw.githubusercontent.com/alfiansetia/DeskPet/main/updates/stable.json";
export const UPDATE_TIMEOUT_MS = 12_000;
export const RELEASES_URL = "https://github.com/alfiansetia/DeskPet/releases";

export interface UpdateFile {
  version: string;
  notes?: string;
  url?: string;
}

/** Validasi isi file versi. Tak dikenal -> null, tak pernah throw. */
export function parseUpdateFile(raw: unknown): UpdateFile | null {
  try {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const o = raw as Record<string, unknown>;
    if (typeof o.version !== "string" || !/^\d+\.\d+\.\d+$/.test(o.version.trim())) return null;
    const url = typeof o.url === "string" ? o.url.trim() : "";
    return {
      version: o.version.trim(),
      notes: typeof o.notes === "string" && o.notes.trim()
        ? o.notes.trim().slice(0, 2000)
        : undefined,
      url: /^https?:\/\/.{3,2000}$/.test(url) ? url : undefined,
    };
  } catch {
    return null;
  }
}

function parseSemver(v: string): [number, number, number] | null {
  const m = v.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** -1 bila a<b, 0 bila sama, 1 bila a>b. Salah satu invalid -> null. */
export function compareVersions(a: string, b: string): number | null {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

export type UpdateStatus =
  | { state: "update"; current: string; latest: UpdateFile }
  | { state: "latest"; current: string; latest: UpdateFile }
  | { state: "error"; current: string; error: string };

/** Sekali fetch (dengan cache-buster). Tak pernah throw; offline/invalid -> error. */
export async function checkForUpdates(
  current: string,
  fetchUrl: string = UPDATE_CHECK_URL,
  timeoutMs: number = UPDATE_TIMEOUT_MS,
): Promise<UpdateStatus> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const sep = fetchUrl.includes("?") ? "&" : "?";
    const r = await fetch(`${fetchUrl}${sep}t=${Date.now()}`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return { state: "error", current, error: `HTTP ${r.status}` };
    const file = parseUpdateFile(await r.json());
    if (!file) return { state: "error", current, error: "file versi tidak valid" };
    const cmp = compareVersions(current, file.version);
    if (cmp === null) return { state: "error", current, error: "versi lokal tidak valid" };
    return cmp < 0
      ? { state: "update", current, latest: file }
      : { state: "latest", current, latest: file };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "timeout" : "network offline/gagal";
    return { state: "error", current, error: msg };
  } finally {
    clearTimeout(t);
  }
}
