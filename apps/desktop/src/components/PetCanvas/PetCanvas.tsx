import { useEffect, useRef, useState, type CSSProperties } from "react";
import { STATE_FRAMES, type PetState } from "../../features/pet/petStateMachine";

interface Props {
  state: PetState;
  reducedMotion: boolean;
  onTap: () => void;
  characterId?: string;
  forcePlaceholder?: boolean;
}

interface AnimationMeta {
  file: string;
  frames: number;
  duration: number;
}

/**
 * Metadata matching PRD §13 for Lavender Cat spritesheets.
 * Frame size: 128x128 per frame.
 */
const SPRITE_CONFIG: Record<PetState, AnimationMeta> = {
  idle: { file: "idle.png", frames: 4, duration: 1.4 },
  walk: { file: "walk.png", frames: 6, duration: 0.8 },
  dragged: { file: "dragged.png", frames: 2, duration: 0.6 },
  sleep: { file: "sleep.png", frames: 4, duration: 2.2 },
  react: { file: "react.png", frames: 4, duration: 0.9 },
  speak: { file: "speak.png", frames: 4, duration: 0.7 },
  attention: { file: "attention.png", frames: 4, duration: 0.8 },
  reminder: { file: "reminder.png", frames: 4, duration: 0.8 },
};

const EXTRA_SPRITE_CONFIG: Record<string, AnimationMeta> = {
  jump: { file: "jump.png", frames: 4, duration: 0.8 },
};

/**
 * Character renderer supporting both PRD §13 pixel-art spritesheets
 * and the P1 pure-CSS placeholder fallback.
 *
 * Fallback rule: if the asset is missing, invalid, or fails to load,
 * the component automatically falls back to rendering the CSS placeholder.
 */
export function PetCanvas({
  state,
  reducedMotion,
  onTap,
  characterId = "deskpet.cat.lavender",
  forcePlaceholder = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [assetFailed, setAssetFailed] = useState(false);
  const animMeta =
    SPRITE_CONFIG[state] ?? EXTRA_SPRITE_CONFIG[state] ?? SPRITE_CONFIG.idle;
  const frames = STATE_FRAMES[state] ?? animMeta.frames;

  const characterFolder = characterId.replace(/^deskpet\.cat\./, "") + "-cat";
  const spriteUrl = `/assets/characters/${characterFolder}/${animMeta.file}`;

  // Gentle float bob effect for idle/walk unless reducedMotion is active
  useEffect(() => {
    if (reducedMotion || state === "sleep") return;
    const el = ref.current;
    if (!el) return;
    el.classList.remove("dp-bob");
    void el.offsetWidth; // restart animation
    el.classList.add("dp-bob");
  }, [state, reducedMotion]);

  const useSprites = !forcePlaceholder && !assetFailed;

  const spriteStyle: CSSProperties = {
    backgroundImage: `url(${spriteUrl})`,
    backgroundSize: `${animMeta.frames * 128}px 128px`,
    animation: reducedMotion
      ? "none"
      : `dp-sprite-steps ${animMeta.duration}s steps(${animMeta.frames}) infinite`,
    backgroundPosition: "0px 0px",
    ["--sprite-end" as string]: `-${animMeta.frames * 128}px`,
  };

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`DeskPet companion, state ${state}`}
      data-testid="pet-canvas"
      data-state={state}
      data-frames={frames}
      data-character={characterId}
      data-render-mode={useSprites ? "sprite" : "placeholder"}
      onClick={onTap}
      className={`dp-pet dp-pet--${state}${useSprites ? " dp-pet--has-sprite" : ""}${
        reducedMotion ? " dp-reduced" : ""
      }`}
    >
      {useSprites ? (
        <div
          className="dp-sprite-view"
          data-testid="pet-sprite"
          style={spriteStyle}
        >
          {/* Invisible image element to detect asset loading failures and trigger fallback */}
          <img
            src={spriteUrl}
            alt=""
            aria-hidden="true"
            style={{ display: "none" }}
            onError={() => setAssetFailed(true)}
          />
        </div>
      ) : (
        /* CSS Placeholder cat (P1 fallback) */
        <>
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
        </>
      )}
    </div>
  );
}
