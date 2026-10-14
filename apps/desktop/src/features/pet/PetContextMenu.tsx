import type { WanderPace, WanderDirection } from "../../lib/store";
import { Icon, type IconName } from "../../components/Icon";

/** Right-click context menu: AKSI CEPAT (langsung jalan, tanpa buka panel).
 * Navigasi panel (asisten/pengingat/tab lain) lewat dobel-klik → asisten + tab,
 * jadi menu ini fokus ke hal yang paling sering diklik: timer, kontrol pet. */
export type MenuAction =
  | "timer-5" | "timer-15" | "timer-25"
  | "feed" | "play"
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

const ITEMS: { id: MenuAction; icon: IconName; label: string; hint?: string; sepAfter?: boolean }[] = [
  { id: "timer-5", icon: "timer", label: "Timer 5 mnt" },
  { id: "timer-15", icon: "timer", label: "Timer 15 mnt" },
  { id: "timer-25", icon: "timer", label: "Timer 25 mnt", sepAfter: true },
  { id: "feed", icon: "plus", label: "Kasih makan" },
  { id: "play", icon: "zap", label: "Ajak main", sepAfter: true },
  { id: "toggle-wander", icon: "move", label: "Jalan otomatis" },
  { id: "cycle-wander-pace", icon: "zap", label: "Kecepatan jalan" },
  { id: "cycle-wander-dir", icon: "moveX", label: "Arah jalan", sepAfter: true },
  { id: "toggle-top", icon: "pin", label: "Selalu di atas" },
  { id: "toggle-motion", icon: "activity", label: "Gerakan tenang", sepAfter: true },
  { id: "scale-up", icon: "zoomIn", label: "Perbesar" },
  { id: "scale-down", icon: "zoomOut", label: "Perkecil" },
  { id: "scale-reset", icon: "rotate", label: "Ukuran normal", sepAfter: true },
  { id: "sleep", icon: "moon", label: "Tidur" },
  { id: "wake", icon: "sun", label: "Bangun" },
  { id: "hide", icon: "eyeOff", label: "Sembunyikan", hint: "Ctrl+Shift+D" },
  { id: "quit", icon: "power", label: "Keluar" },
];

export function PetContextMenu(props: Props) {
  const { x, y, onPick, onClose } = props;
  const w = 240;
  const h = ITEMS.length * 30 + 16;
  const maxW = Math.max(window.innerWidth, 400);
  const maxH = Math.max(window.innerHeight, 560);
  const left = Math.max(8, Math.min(x, maxW - w - 8));
  const top = Math.max(8, Math.min(y, maxH - h - 8));

  const check = (id: MenuAction): boolean => {
    if (id === "toggle-wander") return props.wanderEnabled;
    if (id === "toggle-top") return props.alwaysOnTop;
    if (id === "toggle-motion") return props.reducedMotion;
    if (id === "sleep") return props.sleeping;
    return false;
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
        edges: "Pinggir",
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
              <span className="dp-ctx-check">{check(it.id) ? <Icon name="check" size={12} /> : null}</span>
              <span className="dp-ctx-label"><Icon name={it.icon} size={14} />{it.label}</span>
              {it.hint ? <span className="dp-ctx-hint">{it.hint}</span> : hint(it.id) ? <span className="dp-ctx-hint">{hint(it.id)}</span> : null}
            </button>
            {it.sepAfter ? <div className="dp-ctx-sep" /> : null}
          </div>
        ))}
      </div>
    </>
  );
}
