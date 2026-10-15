/** File log aplikasi (backend `applog`, debug + release).
 * Best-effort, tidak pernah throw: di preview web / backend lama -> null/false.
 */
import { invoke } from "@tauri-apps/api/core";

export async function getAppLogPath(): Promise<string | null> {
  try {
    return await invoke<string>("log_path");
  } catch {
    return null;
  }
}

export async function readAppLog(maxLines = 200): Promise<string | null> {
  try {
    return await invoke<string>("log_read", { maxLines });
  } catch {
    return null;
  }
}

/**
 * Tulis satu baris ke file log backend (`deskpet.log`, local-only).
 * Dipakai mis. mencatat tiap polling API watch (metadata saja: URL,
 * since_id, count — JANGAN kirim title/body privat ke sini).
 * Best-effort, tidak pernah throw.
 */
export async function writeAppLog(level: "info" | "warn" | "error", msg: string): Promise<boolean> {
  try {
    await invoke("log_write", { level, msg });
    return true;
  } catch {
    return false;
  }
}

/**
 * Tampilkan file log di file manager (Explorer/Finder, diseleksi).
 * False bila bukan desktop / path tak ada / permission ditolak.
 */
export async function revealAppLog(): Promise<boolean> {
  try {
    const mod = await import("@tauri-apps/plugin-opener").catch(() => null);
    const reveal = (mod as { revealItemInDir?: (p: string) => Promise<void> } | null)
      ?.revealItemInDir;
    const path = await getAppLogPath();
    if (!reveal || !path) return false;
    await reveal(path);
    return true;
  } catch {
    return false;
  }
}
