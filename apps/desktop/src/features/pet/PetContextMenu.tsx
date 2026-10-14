/** Right-click context menu (PRD §6 quick menu). Replaces the always-visible option bar. */
export type MenuAction =
  | "open-assistant" | "open-reminders" | "open-tasks" | "open-notes"
  | "open-timer" | "open-calendar" | "open-automations" | "open-settings"
  | "toggle-wander" | "toggle-top" | "toggle-motion"
  | "sleep" | "wake" | "hide" | "quit";

interface Props {
  x: number; y: number;
  wanderEnabled: boolean; alwaysOnTop: boolean; reducedMotion: boolean; sleeping: boolean;
  onPick: (a: MenuAction) => void;
  onClose: () => void;
}

const ITEMS: { id: MenuAction; label: string; hint?: string; sepAfter?: boolean }[] = [
  { id: "open-assistant", label: "💬 Asisten", hint: "tanya / perintah" },
  { id: "open-reminders", label: "⏰ Pengingat" },
  { id: "open-tasks", label: "✅ Tugas" },
  { id: "open-notes", label: "📝 Catatan", sepAfter: true },
  { id: "open-timer", label: "⏱️ Timer" },
  { id: "open-calendar", label: "📅 Kalender" },
  { id: "open-automations", label: "⚙️ Otomatisasi" },
  { id: "open-settings", label: "🔧 Pengaturan", sepAfter: true },
  { id: "toggle-wander", label: "🚶 Jalan otomatis" },
  { id: "toggle-top", label: "📌 Selalu di atas" },
  { id: "toggle-motion", label: "🎭 Gerakan tenang", sepAfter: true },
  { id: "sleep", label: "💤 Tidur" },
  { id: "wake", label: "☀️ Bangun" },
  { id: "hide", label: "🙈 Sembunyikan", hint: "Ctrl+Shift+D" },
  { id: "quit", label: "❌ Keluar" },
];

export function PetContextMenu(props: Props) {
  const { x, y, onPick, onClose } = props;
  const w = 240;
  const h = ITEMS.length * 30 + 16;
  const left = Math.min(x, window.innerWidth - w - 8);
  const top = Math.min(y, window.innerHeight - h - 8);

  const check = (id: MenuAction): string => {
    if (id === "toggle-wander") return props.wanderEnabled ? "✓" : "";
    if (id === "toggle-top") return props.alwaysOnTop ? "✓" : "";
    if (id === "toggle-motion") return props.reducedMotion ? "✓" : "";
    if (id === "sleep") return props.sleeping ? "✓" : "";
    return "";
  };

  return (
    <>
      <div className="dp-ctx-backdrop" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="dp-ctx" role="menu" aria-label="DeskPet menu" style={{ left, top }} data-testid="pet-context-menu">
        <div className="dp-ctx-title">DeskPet · klik kanan</div>
        {ITEMS.map((it) => (
          <div key={it.id}>
            <button
              type="button" role="menuitem"
              className="dp-ctx-item"
              onClick={() => onPick(it.id)}
            >
              <span className="dp-ctx-check">{check(it.id)}</span>
              <span className="dp-ctx-label">{it.label}</span>
              {it.hint ? <span className="dp-ctx-hint">{it.hint}</span> : null}
            </button>
            {it.sepAfter ? <div className="dp-ctx-sep" /> : null}
          </div>
        ))}
      </div>
    </>
  );
}
