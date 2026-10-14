import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

/** Penempatan bubble relatif terhadap jangkarnya.
 * - top/bottom: ikut alur flex (di atas / di bawah pet).
 * - left/right: melayang di sisi pet — WAJIB dirender di dalam wrapper
 *   `position: relative` (mis. `.dp-pet-stack`), dan lebar window perlu
 *   dicadangkan manual (lihat `measurePetContentWidth`).
 */
export type BubblePosition = "top" | "bottom" | "left" | "right";
export type BubbleVariant = "pill" | "speech";

interface BubbleProps {
  position?: BubblePosition;
  variant?: BubbleVariant;
  /** Paksa tag. Default: `button` bila ada onClick, `div` bila tidak.
   *  Pakai `as="div"` bila anak mengandung elemen interaktif (mis. tombol
   *  di dalam speech) agar tidak nested-button yang invalid. */
  as?: "button" | "div";
  onClick?: MouseEventHandler;
  title?: string;
  testId?: string;
  /** Kelas tambahan — dipakai untuk kait pengukuran lama
   *  (`dp-bubble-temp`, `dp-bubble-mini`, `dp-speech`). */
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Bubble serbaguna: isi apa pun, posisi top/bottom/left/right.
 *  Contoh: <Bubble position="top" testId="temp-bubble" onClick={...}>28° Hujan</Bubble>
 */
export function Bubble({
  position = "top",
  variant = "pill",
  as,
  onClick,
  title,
  testId,
  className = "",
  style,
  children,
}: BubbleProps) {
  const Tag = (as ?? (onClick ? "button" : "div")) as "button";
  return (
    <Tag
      className={`dp-bubble dp-bubble--${variant} dp-bubble--${position}${className ? ` ${className}` : ""}`}
      data-testid={testId}
      onClick={onClick}
      title={title}
      style={style}
    >
      {children}
    </Tag>
  );
}

/** Tiap berapa ms slot ambient berganti isi (suhu <-> countdown sholat). */
export const SLOT_ROTATE_MS = 4000;
