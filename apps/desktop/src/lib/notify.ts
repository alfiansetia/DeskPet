/** Native notifications + in-app toasts (PRD §5.2). No network. */
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
  // Also try native notification for reminders (best-effort, permission-gated)
  if (kind === "reminder") void nativeNotify(title, body ?? "");
}

export async function nativeNotify(title: string, body: string): Promise<boolean> {
  try {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission !== "granted") return false;
    new Notification(title, { body });
    return true;
  } catch {
    return false;
  }
}

export function permissionState(): string {
  try {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  } catch {
    return "unknown";
  }
}
