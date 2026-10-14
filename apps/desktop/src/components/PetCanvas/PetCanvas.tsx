import { useEffect, useRef, useState, type CSSProperties } from "react";
import { STATE_FRAMES, type PetState } from "../../features/pet/petStateMachine";
import { isDefaultPalette, resolvePalette } from "../../features/pet/palettes";
import { HAT_ANCHORS, hatById } from "../../features/pet/hats";
import { isPetSpecies, type PetSpecies } from "../../features/pet/species";
import { useRecoloredSprite } from "../../features/pet/recolor";

interface Props {
  state: PetState;
  reducedMotion: boolean;
  onTap: () => void;
  /** @deprecated Spesies kini lewat `species`. Dipertahankan agar caller lama tidak rusak; diabaikan. */
  characterId?: string;
  species?: PetSpecies | string;
  paletteId?: string;
  customColor?: string;
  /** Id topi aktif ("none"/null = tanpa topi). Dirender di koordinat 128px. */
  hat?: string | null;
  forcePlaceholder?: boolean;
  speed?: "normal" | "fast" | "slow";
}

interface AnimationMeta {
  file: string;
  frames: number;
  duration: number;
}

/**
 * Metadata animasi PRD §13. Berlaku untuk semua spesies
 * (setiap paket wajib menyediakan 9 file ini dengan jumlah frame yang sama).
 * Frame size: 128x128 per frame.
 */
const SPRITE_CONFIG: Record<PetState, AnimationMeta> = {
  idle:      { file: "idle.png",      frames: 4, duration: 1.4 },
  walk:      { file: "walk.png",      frames: 6, duration: 0.8 },
  dragged:   { file: "dragged.png",   frames: 2, duration: 0.6 },
  sleep:     { file: "sleep.png",     frames: 4, duration: 2.2 },
  react:     { file: "react.png",     frames: 4, duration: 0.9 },
  speak:     { file: "speak.png",     frames: 4, duration: 0.7 },
  attention: { file: "attention.png", frames: 4, duration: 0.8 },
  reminder:  { file: "reminder.png",  frames: 4, duration: 0.8 },
  jump:      { file: "jump.png",      frames: 4, duration: 0.8 }, // 4 frames @ fps 5
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
  species = "cat",
  paletteId = "lavender",
  customColor = "",
  hat = null,
  forcePlaceholder = false,
  speed = "normal",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [assetFailed, setAssetFailed] = useState(false);
  const animMeta = SPRITE_CONFIG[state] ?? SPRITE_CONFIG.idle;
  const frames = STATE_FRAMES[state] ?? animMeta.frames;

  // Multi-spesies: satu folder aset per spesies (`assets/characters/<species>`).
  // Nilai tak dikenal jatuh ke kucing agar placeholder/sprite tidak pernah broken.
  const activeSpecies: PetSpecies = isPetSpecies(species) ? species : "cat";
  const spriteUrl = `/assets/characters/${activeSpecies}/${animMeta.file}`;

  const palette = resolvePalette(paletteId, customColor);
  const needsRecolor = !isDefaultPalette(palette);

  // Topi overlay (emoji, pointer-events none agar drag/klik tetap ke pet).
  const hatDef = hatById(hat ?? "none");
  const hatAnchor = HAT_ANCHORS[activeSpecies];
  const showHat = hatDef.id !== "none";

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
  const { url: spriteSrc } = useRecoloredSprite(spriteUrl, palette, needsRecolor && useSprites);

  const duration =
    state === "walk"
      ? speed === "fast"
        ? 0.36
        : speed === "slow"
        ? 1.25
        : animMeta.duration
      : animMeta.duration;

  const spriteStyle: CSSProperties = {
    backgroundImage: `url(${spriteSrc})`,
    backgroundSize: `${animMeta.frames * 128}px 128px`,
    animation: reducedMotion
      ? "none"
      : `dp-sprite-steps ${duration}s steps(${animMeta.frames}) infinite`,
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
      data-character={`deskpet.${activeSpecies}`}
      data-palette={palette.id}
      data-render-mode={useSprites ? "sprite" : "placeholder"}
      onClick={onTap}
      className={`dp-pet dp-pet--${state} dp-species--${activeSpecies} dp-speed--${speed}${useSprites ? " dp-pet--has-sprite" : ""}${
        reducedMotion ? " dp-reduced" : ""
      }`}
    >
      {showHat && (
        <span
          className="dp-hat"
          data-testid="pet-hat"
          data-hat={hatDef.id}
          aria-hidden="true"
          style={{
            left: `calc(50% + ${hatAnchor.dx}px)`,
            top: `${hatAnchor.top}px`,
            fontSize: `${hatAnchor.size}px`,
          }}
        >
          {hatDef.emoji}
        </span>
      )}
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
