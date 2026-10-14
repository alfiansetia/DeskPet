/** Regression: overlay teks (sapaan/hati/emote) TIDAK ikut kecermin saat pet
 * menghadap kiri — mereka duduk di layer stack, di luar wrap yang di-flip.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import App from "./App";

describe("App overlay flip", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

  it("sapaan dirender di stack, bukan di dalam wrap yang di-flip", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<App />);
    const region = screen.getByTestId("drag-region");
    fireEvent.mouseDown(region, { button: 0 });
    fireEvent.mouseUp(region);
    const greet = screen.getByTestId("pet-greet");
    expect(greet.textContent!.length).toBeGreaterThan(0);
    // di dalam stack (tak ter-flip) ...
    expect(screen.getByTestId("pet-stack").contains(greet)).toBe(true);
    // ... bukan di dalam wrap yang kena scaleX(-1)
    expect(document.querySelector(".dp-pet-wrap .dp-greet")).toBeNull();
  });

  it("menoleh kiri mem-flip wrap, overlay tetap di luar", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<App />);
    const region = screen.getByTestId("drag-region");
    // getBoundingClientRect jsdom = nol semua -> tengah di 0
    fireEvent.mouseMove(region, { clientX: -5 });
    expect(region.style.transform).toContain("scale(-");
    fireEvent.mouseDown(region, { button: 0 });
    fireEvent.mouseUp(region);
    // klik memicu react -> facing override dibersihkan (by design)
    const greet = screen.getByTestId("pet-greet");
    expect(document.querySelector(".dp-pet-wrap .dp-greet")).toBeNull();
    expect(screen.getByTestId("pet-stack").contains(greet)).toBe(true);
  });
});
