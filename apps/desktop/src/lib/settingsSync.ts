/** Durable settings sync (local-first).
 * - Fast cache: localStorage (works in web preview too).
 * - Durable copy: Rust backend file `<app_local_data>/frontend-settings.json`,
 *   independent of WebView origin/profile. Wins on boot when present.
 * - Web preview / old backend: invoke fails -> silently keep local behavior.
 */
import { invoke } from "@tauri-apps/api/core";
import { normalizeSettings, type DeskSettings } from "./store";

export async function pullBackendSettings(): Promise<DeskSettings | null> {
  try {
    const raw = await invoke<string | null>("frontend_settings_get");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeskSettings>;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return normalizeSettings(parsed);
  } catch {
    return null;
  }
}

export function pushBackendSettings(s: DeskSettings): void {
  try {
    const p = invoke("frontend_settings_put", { json: JSON.stringify({ ...s, telemetryEnabled: false }) });
    void (p as Promise<unknown>).catch(() => { /* best-effort */ });
  } catch {
    /* backend unavailable (web preview) */
  }
}
