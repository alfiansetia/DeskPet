/** In-app toasts + speech bubble di atas pet (PRD §5.2).
 * Sengaja TIDAK memakai Notification API browser/OS: tidak ada prompt izin,
 * tidak ada status "ditolak". Semua pesan (alarm, sholat, timer) tampil
 * langsung sebagai bubble/toast dalam app + karakter membesar 200%.
 */
export interface Toast { id: string; title: string; body?: string; kind: "info" | "reminder" | "error" | "success"; }

type Listener = (t: Toast) => void;
const listeners = new Set<Listener>();

export function onToast(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function toast(title: string, body?: string, kind: Toast["kind"] = "info"): void {
  const t: Toast = { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, title, body, kind };
  listeners.forEach((fn) => { try { fn(t); } catch { /* noop */ } });
}
