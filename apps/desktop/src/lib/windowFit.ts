/**
 * windowFit: jaga window tetap terlihat penuh di dalam work-area monitor.
 *
 * Masalah: window pet membesar dengan anchor kiri-atas (menu 400x560,
 * panel 400x620, bubble/alert). Kalau pet sedang di pojok kanan/bawah
 * layar, window meluber keluar layar -> menu/panel kepotong.
 * Solusi: setelah resize, geser window (kanan->kiri, bawah->atas,
 * kiri->kanan, atas->bawah) secukupnya agar muat di work-area.
 */
import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { readWorkAreaPhysical, type WorkArea } from "../features/pet/useWander";

export interface RectArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Murni: geser top-left (x,y) agar rect w×h muat dalam area.
 * Semua argumen dalam satuan px yang SAMA (physical ATAU logical).
 * Bila window lebih besar dari area, jangkar ke kiri-atas area.
 */
export function fitTopLeft(
  x: number,
  y: number,
  w: number,
  h: number,
  area: RectArea,
): { x: number; y: number } {
  let nx = Math.min(x, area.right - w);
  let ny = Math.min(y, area.bottom - h);
  nx = Math.max(nx, area.left);
  ny = Math.max(ny, area.top);
  return { x: Math.round(nx), y: Math.round(ny) };
}

/**
 * Best-effort: pastikan window berukuran logicalW×logicalH (CSS px)
 * sepenuhnya terlihat di work-area monitor (taskbar/dock dikecualikan
 * di monitor utama, mengikuti pola useWander).
 * Aman dipanggil di web preview / jsdom: selalu try/catch -> noop.
 */
export async function keepWindowOnScreen(
  logicalW: number,
  logicalH: number,
): Promise<void> {
  try {
    const win = getCurrentWindow();
    const scale = await win.scaleFactor().catch(() => 1);
    const pos = await win.outerPosition();
    const mon = await currentMonitor().catch(() => null);

    let area: WorkArea | null = null;
    if (mon) {
      const isPrimary = mon.position.x === 0 && mon.position.y === 0;
      area = isPrimary ? readWorkAreaPhysical(scale) : null;
      if (!area) {
        area = {
          left: mon.position.x,
          top: mon.position.y,
          right: mon.position.x + mon.size.width,
          bottom: mon.position.y + mon.size.height,
        };
      }
    } else {
      area = readWorkAreaPhysical(scale);
    }
    if (!area) return;

    const w = Math.round(logicalW * scale);
    const h = Math.round(logicalH * scale);
    const next = fitTopLeft(pos.x, pos.y, w, h, area);
    if (next.x !== pos.x || next.y !== pos.y) {
      await win.setPosition(new PhysicalPosition(next.x, next.y));
    }
  } catch {
    /* preview / headless: abaikan */
  }
}
