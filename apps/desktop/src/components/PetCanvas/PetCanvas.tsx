import { useEffect, useRef } from "react";
import { STATE_FRAMES, type PetState } from "../../features/pet/petStateMachine";

interface Props {
  state: PetState;
  reducedMotion: boolean;
  onTap: () => void;
}

/**
 * Placeholder character: pure-CSS pastel cat (no binary asset required in P1).
 * Idle = gentle bob; walk = side sway; sleep = dimmed; dragged = scaled.
 * Respects `prefers-reduced-motion` + `reducedMotion` prop (PRD §5.1).
 * If a future spritesheet is missing/invalid, this component is the fallback.
 */
export function PetCanvas({ state, reducedMotion, onTap }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const frames = STATE_FRAMES[state] ?? STATE_FRAMES.idle;

  useEffect(() => {
    if (reducedMotion || state === "sleep") return;
    const el = ref.current;
    if (!el) return;
    el.classList.remove("dp-bob");
    void el.offsetWidth; // restart animation
    el.classList.add("dp-bob");
  }, [state, reducedMotion]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`DeskPet companion, state ${state}`}
      data-testid="pet-canvas"
      data-state={state}
      data-frames={frames}
      onClick={onTap}
      className={`dp-pet dp-pet--${state}${reducedMotion ? " dp-reduced" : ""}`}
    >
      <div className="dp-face" aria-hidden="true">
        <span className="dp-eye dp-eye--l" />
        <span className="dp-eye dp-eye--r" />
        <span className="dp-blush dp-blush--l" />
        <span className="dp-blush dp-blush--r" />
        <span className="dp-mouth" />
      </div>
      <div className="dp-ears" aria-hidden="true">
        <span className="dp-ear dp-ear--l" />
        <span className="dp-ear dp-ear--r" />
      </div>
    </div>
  );
}
