/** Runtime recolor untuk spritesheet PNG basis lavender.
 *
 * Pixel-art flat-fill -> ganti exact-match per token body, dengan toleransi
 * kecil untuk tepi anti-alias. Piksel transparan & warna terkunci
 * (outline, mata, kalung, efek animasi) tidak disentuh.
 */
import { LAVENDER_SOURCE, normalizeHex, type CatPalette } from "./palettes";

export interface RgbMap {
  src: [number, number, number];
  dst: [number, number, number];
}

function hexToRgbArr(hex: string): [number, number, number] {
  const n = normalizeHex(hex);
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
}

/** Bangun tabel src(lavender)->dst dari palette target. */
export function buildRecolorMap(palette: CatPalette): RgbMap[] {
  const pairs: [string, string][] = [
    [LAVENDER_SOURCE.bodyMain, palette.bodyMain],
    [LAVENDER_SOURCE.bodyLight, palette.bodyLight],
    [LAVENDER_SOURCE.bodyShadow, palette.bodyShadow],
    [LAVENDER_SOURCE.belly, palette.belly],
  ];
  return pairs.map(([s, d]) => ({ src: hexToRgbArr(s), dst: hexToRgbArr(d) }));
}

const dist2 = (a: [number, number, number], r: number, g: number, b: number) =>
  (a[0] - r) * (a[0] - r) + (a[1] - g) * (a[1] - g) + (a[2] - b) * (a[2] - b);

/**
 * Recolor in-place pada buffer RGBA. Pure (tanpa DOM) agar bisa di-unit-test.
 * @returns jumlah piksel yang diganti.
 */
export function recolorPixels(data: Uint8ClampedArray, map: RgbMap[], tolerance = 16): number {
  const tol2 = tolerance * tolerance;
  let changed = 0;
  for (let i = 0; i + 3 < data.length + 1; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    let hit: RgbMap | null = null;
    for (const m of map) {
      if (m.src[0] === r && m.src[1] === g && m.src[2] === b) { hit = m; break; }
    }
    if (!hit && tolerance > 0) {
      let best = tol2;
      for (const m of map) {
        const d = dist2(m.src, r, g, b);
        if (d <= best) { best = d; hit = m; }
      }
      // best==tol2 tapi tidak exact tetap boleh (tepi blend); aman dari putih
      // murni karena belly (#EBE6FF) berjarak ~32 dari #FFFFFF > toleransi 16.
    }
    if (hit) {
      data[i] = hit.dst[0]; data[i + 1] = hit.dst[1]; data[i + 2] = hit.dst[2];
      changed++;
    }
  }
  return changed;
}

/** Recolor satu <img> yang sudah load -> canvas baru. Butuh DOM/canvas. */
export function recolorImageElement(img: HTMLImageElement, map: RgbMap[], tolerance = 16): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d unavailable");
  ctx.drawImage(img, 0, 0);
  const frame = ctx.getImageData(0, 0, w, h);
  recolorPixels(frame.data, map, tolerance);
  ctx.putImageData(frame, 0, 0);
  return canvas;
}

const urlCache = new Map<string, string>();

/**
 * Hook: load sprite asli -> recolor -> kembalikan object/data URL.
 * Gagal / non-recolorable -> fallback ke URL asli (aturan fallback PRD §5.1).
 */
import { useEffect, useState } from "react";

export function useRecoloredSprite(srcUrl: string, palette: CatPalette, enabled: boolean): { url: string; pending: boolean } {
  const [out, setOut] = useState(srcUrl);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!enabled) { setOut(srcUrl); setPending(false); return; }
    const key = `${srcUrl}|${palette.bodyMain},${palette.bodyLight},${palette.bodyShadow},${palette.belly}`;
    const cached = urlCache.get(key);
    if (cached) { setOut(cached); setPending(false); return; }
    let cancelled = false;
    setPending(true);
    setOut(srcUrl); // tampilkan asli dulu, hindari kedip kosong
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = recolorImageElement(img, buildRecolorMap(palette));
        const url = canvas.toDataURL("image/png");
        urlCache.set(key, url);
        setOut(url);
      } catch {
        setOut(srcUrl);
      } finally {
        setPending(false);
      }
    };
    img.onerror = () => { if (!cancelled) { setOut(srcUrl); setPending(false); } };
    img.src = srcUrl;
    return () => { cancelled = true; };
  }, [srcUrl, enabled, palette.bodyMain, palette.bodyLight, palette.bodyShadow, palette.belly]);

  return { url: out, pending };
}

/** Untuk test: bersihkan cache antar test. */
export function __clearRecolorCache(): void {
  urlCache.clear();
}
