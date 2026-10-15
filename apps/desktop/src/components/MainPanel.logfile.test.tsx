/** Tab Log: tombol "Hapus file" mengosongkan file log backend via command. */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, afterEach, vi } from "vitest";
import { MainPanel } from "./MainPanel";
import { invoke } from "@tauri-apps/api/core";
import { loadSettings } from "../lib/store";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;

describe("tab Log hapus file", () => {
  afterEach(() => { cleanup(); localStorage.clear(); mockInvoke.mockReset(); });

  function renderLog() {
    return render(
      <MainPanel tab="log" setTab={() => {}} onClose={() => {}}
        settings={loadSettings()} setSettings={() => {}}
        refreshKey={0} bump={() => {}} timerStart={() => {}} timerLeft={null} />
    );
  }

  it("tombol Hapus file memanggil log_clear + tampil kosong", async () => {
    let cleared = false;
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "log_path") return Promise.resolve("/tmp/deskpet.log");
      if (cmd === "log_read") return Promise.resolve(cleared ? "" : "baris1\nbaris2");
      if (cmd === "log_clear") { cleared = true; return Promise.resolve(42); }
      return Promise.reject(new Error("unknown"));
    });
    renderLog();
    await waitFor(() => {
      expect(screen.getByTestId("applog-text").textContent).toContain("baris1");
    });
    fireEvent.click(screen.getByTitle("Kosongkan file log + salinan rotasi"));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("log_clear");
    });
    await waitFor(() => {
      expect(screen.getByTestId("applog-text").textContent).toContain("File log masih kosong.");
    });
  });
});
