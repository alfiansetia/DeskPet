/** Autostart OS (Windows Run key / macOS LaunchAgent) via plugin resmi.
 *  Semua fungsi aman di web-preview/jsdom: gagal backend -> "unsupported".
 */
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

export type AutostartState = "enabled" | "disabled" | "unsupported";

/** Cek status autostart yang TERPASANG di OS saat ini. */
export async function getAutostartState(): Promise<AutostartState> {
  try {
    return (await isEnabled()) ? "enabled" : "disabled";
  } catch {
    return "unsupported"; // web preview / backend tak tersedia
  }
}

/** Pasang (true) atau copot (false) autostart OS. Gagal -> throw (pesan user). */
export async function setAutostart(on: boolean): Promise<void> {
  if (on) await enable();
  else await disable();
}

/** Samakan OS dengan niat user: pasang bila setting on tapi belum terpasang.
 *  Dipakai saat boot ("perbaiki/fix bila belum ada"). Gagal diam-diam
 *  (best-effort) kecuali diminta throw. */
export async function ensureAutostart(wanted: boolean, strict = false): Promise<AutostartState> {
  const state = await getAutostartState();
  if (state === "unsupported") {
    if (strict) throw new Error("Autostart tidak didukung di mode preview.");
    return state;
  }
  if (wanted && state === "disabled") {
    try {
      await enable();
      return "enabled";
    } catch (e) {
      if (strict) throw e instanceof Error ? e : new Error(String(e));
      return "disabled";
    }
  }
  if (!wanted && state === "enabled") {
    try {
      await disable();
      return "disabled";
    } catch (e) {
      if (strict) throw e instanceof Error ? e : new Error(String(e));
      return "enabled";
    }
  }
  return state;
}
