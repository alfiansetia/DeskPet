/** Hover kursor di dalam window (pengganti listener manual di App).
 * Robust lintas platform: masuk = `mouseover`/`mousemove` (bubble ke window),
 * keluar = `mouseout` yang targetnya di luar dokumen + `mouseleave` di
 * document + `blur` window.
 *
 * JANGAN pakai `mouseenter`/`mouseleave` di `window`: keduanya tidak bubble
 * sehingga listener window praktis mati (hovered macet true selamanya).
 */
import { useEffect, useState } from "react";

export function useWindowHover(): boolean {
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const onOver = () => setHovered(true);
    const onOut = (e: MouseEvent) => {
      const to = e.relatedTarget as Node | null;
      if (!to || !document.documentElement.contains(to)) setHovered(false);
    };
    const onGone = () => setHovered(false);
    window.addEventListener("mouseover", onOver);
    window.addEventListener("mousemove", onOver);
    window.addEventListener("mouseout", onOut);
    document.addEventListener("mouseleave", onGone);
    window.addEventListener("blur", onGone);
    return () => {
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("mousemove", onOver);
      window.removeEventListener("mouseout", onOut);
      document.removeEventListener("mouseleave", onGone);
      window.removeEventListener("blur", onGone);
    };
  }, []);
  return hovered;
}
