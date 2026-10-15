/** Grup tab panel: Kerja, Waktu, Karakter, Sistem. Karakter (Pengaturan +
 *  Kawan) keluar dari Sistem; default grup Karakter = Pengaturan. */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, afterEach, vi } from "vitest";
import { MainPanel, type PanelTab } from "./MainPanel";
import { loadSettings } from "../lib/store";

function renderAt(tab: PanelTab, setTab: (t: PanelTab) => void = () => {}) {
  return render(
    <MainPanel tab={tab} setTab={setTab} onClose={() => {}}
      settings={loadSettings()} setSettings={() => {}}
      refreshKey={0} bump={() => {}} timerStart={() => {}} timerLeft={null} />
  );
}

describe("grup tab panel", () => {
  afterEach(() => { cleanup(); localStorage.clear(); });

  it("urutan pil grup: Kerja, Waktu, Karakter, Sistem", () => {
    renderAt("assistant");
    const pills = ["Kategori Kerja", "Kategori Waktu", "Kategori Karakter", "Kategori Sistem"]
      .map((t) => screen.getByTitle(t));
    const order = pills.map((el) => {
      const parent = el.parentElement!;
      return Array.from(parent.children).indexOf(el);
    });
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(pills).toHaveLength(4);
  });

  it("Kawan dan Pengaturan satu grup Karakter (bukan Sistem)", () => {
    renderAt("companions");
    expect(screen.getByTitle("Kategori Karakter").className).toContain("on");
    expect(screen.getByTitle("Kategori Sistem").className).not.toContain("on");
  });

  it("klik pil Karakter -> default tab Pengaturan", () => {
    const setTab = vi.fn();
    renderAt("log", setTab);
    fireEvent.click(screen.getByTitle("Kategori Karakter"));
    expect(setTab).toHaveBeenCalledWith("settings");
  });

  it("Tentang dan Log tetap di Sistem", () => {
    renderAt("about");
    expect(screen.getByTitle("Kategori Sistem").className).toContain("on");
    expect(screen.getByTitle("Kategori Karakter").className).not.toContain("on");
  });
});
