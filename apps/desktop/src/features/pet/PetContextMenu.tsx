import type { WanderPace, WanderDirection } from "../../lib/store";

/** Right-click context menu (PRD §6 quick menu). Replaces the always-visible option bar. */
export type MenuAction =
  | "open-assistant" | "open-reminders" | "open-tasks" | "open-notes"
  | "open-timer" | "open-calendar" | "open-automations" | "open-settings"
  | "toggle-wander" | "cycle-wander-pace" | "cycle-wander-dir" | "toggle-top" | "toggle-motion"
  | "scale-up" | "scale-down" | "scale-reset"
  | "sleep" | "wake" | "hide" | "quit";

interface Props {
  x: number; y: number;
  wanderEnabled: boolean;
  wanderPace?: WanderPace;
  wanderDirection?: WanderDirection;
  alwaysOnTop: boolean; reducedMotion: boolean; sleeping: boolean;
  petScale?: number;
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
  { id: "cycle-wander-pace", label: "⚡ Kecepatan jalan" },
  { id: "cycle-wander-dir", label: "↔️ Arah jalan" },
  { id: "toggle-top", label: "📌 Selalu di atas" },
  { id: "toggle-motion", label: "🎭 Gerakan tenang", sepAfter: true },
  { id: "scale-up", label: "🔍＋ Perbesar" },
  { id: "scale-down", label: "🔍－ Perkecil" },
  { id: "scale-reset", label: "↩ Ukuran normal", sepAfter: true },
  { id: "sleep", label: "💤 Tidur" },
  { id: "wake", label: "☀️ Bangun" },
  { id: "hide", label: "🙈 Sembunyikan", hint: "Ctrl+Shift+D" },
  { id: "quit", label: "❌ Keluar" },
];

export function PetContextMenu(props: Props) {
  const { x, y, onPick, onClose } = props;
  const w = 240;
  const h = ITEMS.length * 30 + 16;
  const maxW = Math.max(window.innerWidth, 400);
  const maxH = Math.max(window.innerHeight, 560);
  const left = Math.max(8, Math.min(x, maxW - w - 8));
  const top = Math.max(8, Math.min(y, maxH - h - 8));

  const check = (id: MenuAction): string => {
    if (id === "toggle-wander") return props.wanderEnabled ? "✓" : "";
    if (id === "toggle-top") return props.alwaysOnTop ? "✓" : "";
    if (id === "toggle-motion") return props.reducedMotion ? "✓" : "";
    if (id === "sleep") return props.sleeping ? "✓" : "";
    return "";
  };

  const hint = (id: MenuAction): string => {
    if (id === "cycle-wander-pace") {
      const paceLabels: Record<string, string> = {
        random: "Acak",
        slow: "Pelan",
        fast: "Lari",
        normal: "Normal",
      };
      return paceLabels[props.wanderPace ?? "random"] ?? "Acak";
    }
    if (id === "cycle-wander-dir") {
      const dirLabels: Record<string, string> = {
        random: "Acak",
        horizontal: "Kiri-Kanan",
        vertical: "Atas-Bawah",
      };
      return dirLabels[props.wanderDirection ?? "random"] ?? "Acak";
    }
    if (id === "scale-up" || id === "scale-down" || id === "scale-reset") {
      const pct = Math.round((props.petScale ?? 1) * 100);
      if (id === "scale-up") return pct >= 200 ? "max" : `${pct}%`;
      if (id === "scale-down") return pct <= 50 ? "min" : `${pct}%`;
      return `${pct}%`;
    }
    return "";
  };

  return (
    <>
      <div
        className="dp-ctx-backdrop"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        className="dp-ctx"
        role="menu"
        aria-label="DeskPet menu"
        style={{ left, top }}
        data-testid="pet-context-menu"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
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
              {it.hint ? <span className="dp-ctx-hint">{it.hint}</span> : hint(it.id) ? <span className="dp-ctx-hint">{hint(it.id)}</span> : null}
            </button>
            {it.sepAfter ? <div className="dp-ctx-sep" /> : null}
          </div>
        ))}
      </div>
    </>
  );
}
