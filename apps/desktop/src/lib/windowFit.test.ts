/** windowFit: window yang meluber keluar work-area harus digeser masuk. */
import { describe, expect, it } from "vitest";
import { fitTopLeft } from "./windowFit";

// Layar 1920x1080, taskbar 48px -> work-area 1920x1032 di (0,0).
const AREA = { left: 0, top: 0, right: 1920, bottom: 1032 };

describe("fitTopLeft", () => {
  it("tidak menggeser bila sudah muat", () => {
    expect(fitTopLeft(100, 100, 400, 620, AREA)).toEqual({ x: 100, y: 100 });
  });

  it("pojok kanan -> geser ke kiri", () => {
    // Pet di x=1800, window panel 400 lebar -> meluber 280px.
    expect(fitTopLeft(1800, 100, 400, 620, AREA)).toEqual({ x: 1520, y: 100 });
  });

  it("pojok bawah -> geser ke atas", () => {
    // Pet di y=900, window menu 560 tinggi -> meluber 428px.
    expect(fitTopLeft(100, 900, 400, 560, AREA)).toEqual({ x: 100, y: 472 });
  });

  it("pojok kanan-bawah -> geser kiri-atas sekaligus", () => {
    expect(fitTopLeft(1800, 900, 400, 620, AREA)).toEqual({ x: 1520, y: 412 });
  });

  it("pojok kiri-atas di luar area -> tarik masuk", () => {
    expect(fitTopLeft(-50, -30, 400, 620, AREA)).toEqual({ x: 0, y: 0 });
  });

  it("window lebih besar dari area -> jangkar kiri-atas", () => {
    expect(fitTopLeft(500, 500, 2500, 1400, AREA)).toEqual({ x: 0, y: 0 });
  });

  it("tepat mentok di tepi -> tidak bergeser", () => {
    expect(fitTopLeft(1520, 412, 400, 620, AREA)).toEqual({ x: 1520, y: 412 });
  });
});
