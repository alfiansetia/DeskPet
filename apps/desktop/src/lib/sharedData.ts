/** Single shared DB untuk multi-window (opsi B: 1 window per companion).
 *
 * Prinsip:
 * - Data produktivitas (reminders/todos/notes/events/automations/timer)
 *   adalah GLOBAL — satu sumber kebenaran, terlihat sama dari semua window.
 * - `createdBy` di item hanya info display ("dibuat dari window X"),
 *   TIDAK PERNAH dipakai sebagai filter kepemilikan / partisi data.
 * - Yang per-companion hanya: species/palette/scale/role/showTemp/showMini/shy
 *   + ephemeral animation state (Rust PetRegistry).
 * - Scheduler/notifikasi single-executor: hanya primary (`main`) yang fire;
 *   window lain hanya display + terima routing presenter via role.
 *
 * Sinkronisasi:
 * - localStorage `storage` event menjangkau window lain (same-origin).
 * - Event Tauri `deskpet://data-changed` sebagai jaring pengaman bila
 *   `storage` event tidak menyeberang antar WebviewWindow.
 * - Panel daftar subscribe agar tambah/ubah dari window A langsung
 *   terlihat di window B tanpa perlu buka-tutup panel.
 */

export type SharedDataKind =
  | "reminders"
  | "todos"
  | "notes"
  | "events"
  | "automations"
  | "audit";

export const DATA_CHANGED_EVENT = "deskpet://data-changed";

/** Broadcast perubahan data ke window lain. Best-effort, tidak pernah throw. */
export function notifyDataChanged(kind: SharedDataKind): void {
  try {
    window.dispatchEvent(new CustomEvent("deskpet:data-changed", { detail: { kind } }));
  } catch { /* noop */ }
  try {
    // Dynamic import agar vitest/jsdom + web preview tetap jalan tanpa Tauri.
    void import("@tauri-apps/api/event")
      .then((m) => m.emit(DATA_CHANGED_EVENT, { kind }).catch(() => {}))
      .catch(() => {});
  } catch { /* preview: abaikan */ }
}

/** Subscribe perubahan data lintas window. Return unsubscribe. */
export function subscribeDataChanged(
  kinds: SharedDataKind | SharedDataKind[],
  cb: (kind: SharedDataKind) => void,
): () => void {
  const want = new Set(Array.isArray(kinds) ? kinds : [kinds]);
  const onLocal = (e: Event) => {
    try {
      const kind = (e as CustomEvent).detail?.kind as SharedDataKind;
      if (kind && want.has(kind)) cb(kind);
    } catch { /* noop */ }
  };
  const onStorage = (e: StorageEvent) => {
    if (!e.key) return;
    const map: Record<string, SharedDataKind> = {
      "deskpet:reminders": "reminders",
      "deskpet:todos": "todos",
      "deskpet:notes": "notes",
      "deskpet:events": "events",
      "deskpet:automations": "automations",
      "deskpet:audit": "audit",
    };
    const kind = map[e.key];
    if (kind && want.has(kind)) cb(kind);
  };
  window.addEventListener("deskpet:data-changed", onLocal as EventListener);
  window.addEventListener("storage", onStorage);
  let unlistenTauri: (() => void) | null = null;
  try {
    void import("@tauri-apps/api/event")
      .then((m) =>
        m
          .listen(DATA_CHANGED_EVENT, (ev) => {
            const kind = (ev.payload as { kind?: SharedDataKind } | null)?.kind;
            if (kind && want.has(kind)) cb(kind);
          })
          .then((u) => {
            unlistenTauri = u;
          })
          .catch(() => {}),
      )
      .catch(() => {});
  } catch { /* preview */ }
  return () => {
    window.removeEventListener("deskpet:data-changed", onLocal as EventListener);
    window.removeEventListener("storage", onStorage);
    try {
      unlistenTauri?.();
    } catch { /* noop */ }
  };
}
