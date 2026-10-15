/** Tab Tentang: info app + backup/restore + cek update manual. */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, afterEach, vi } from "vitest";
import { MainPanel, type PanelTab } from "./MainPanel";
import { loadSettings } from "../lib/store";
import { APP_VERSION } from "../lib/appInfo";

function renderAt(tab: PanelTab) {
  return render(
    <MainPanel tab={tab} setTab={() => {}} onClose={() => {}}
      settings={loadSettings()} setSettings={() => {}}
      refreshKey={0} bump={() => {}} timerStart={() => {}} timerLeft={null} />
  );
}

describe("tab Tentang", () => {
  afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

  it("tampilkan versi app + tombol Backup/Restore/Cek update", () => {
    renderAt("about");
    expect(screen.getByTestId("about-app").textContent).toContain(APP_VERSION);
    expect(screen.getByRole("button", { name: /Backup/ })).not.toBeNull();
    expect(screen.getByRole("button", { name: /Restore/ })).not.toBeNull();
    expect(screen.getByRole("button", { name: /Cek update/ })).not.toBeNull();
  });

  it("Cek update: versi baru -> tampilkan info rilis", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ version: "9.9.9", notes: " centuries", url: "https://contoh.id/rilis" }),
    }));
    renderAt("about");
    fireEvent.click(screen.getByRole("button", { name: /Cek update/ }));
    await waitFor(() => {
      expect(screen.getByTestId("about-update-result").textContent).toContain("9.9.9");
    });
  });

  it("Cek update offline -> pesan error tanpa throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    renderAt("about");
    fireEvent.click(screen.getByRole("button", { name: /Cek update/ }));
    await waitFor(() => {
      expect(screen.getByTestId("about-update-result").textContent).toContain("Gagal");
    });
  });

  it("Backup tanpa backend (preview) -> fallback unduhan, tanpa throw", async () => {
    const createURL = vi.fn().mockReturnValue("blob:fake");
    vi.stubGlobal("URL", { createObjectURL: createURL, revokeObjectURL: vi.fn() });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      renderAt("about");
      fireEvent.click(screen.getByRole("button", { name: /^Backup/ }));
      await waitFor(() => {
        expect(createURL).toHaveBeenCalled();
      });
    } finally {
      clickSpy.mockRestore();
    }
  });
});
