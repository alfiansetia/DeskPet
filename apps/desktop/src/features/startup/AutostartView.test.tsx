/** AutostartView: checkbox + status OS + tombol pasang saat mismatch. */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

vi.mock("./autostart", () => ({
  getAutostartState: vi.fn(),
  ensureAutostart: vi.fn(),
}));

import { getAutostartState, ensureAutostart } from "./autostart";
import { AutostartView } from "./AutostartView";
import { DEFAULT_SETTINGS } from "../../lib/store";

const mockGet = vi.mocked(getAutostartState);
const mockEnsure = vi.mocked(ensureAutostart);

describe("AutostartView", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("status awal dari OS", async () => {
    mockGet.mockResolvedValue("disabled");
    render(<AutostartView settings={DEFAULT_SETTINGS} upd={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId("autostart-status").textContent).toContain("belum terpasang");
    });
  });

  it("centang on -> simpan niat + pasang ke OS", async () => {
    mockGet.mockResolvedValue("disabled");
    mockEnsure.mockResolvedValue("enabled");
    const upd = vi.fn();
    render(<AutostartView settings={DEFAULT_SETTINGS} upd={upd} />);
    await waitFor(() => expect(screen.getByTestId("autostart-status").textContent).toContain("belum terpasang"));
    fireEvent.click(screen.getByRole("checkbox"));
    expect(upd).toHaveBeenCalledWith({ autoStart: true });
    await waitFor(() => {
      expect(mockEnsure).toHaveBeenCalledWith(true, true);
      expect(screen.getByTestId("autostart-status").textContent).toContain("aktif di OS");
    });
  });

  it("mismatch (niat on, OS off) -> tombol Pasang memperbaiki", async () => {
    mockGet.mockResolvedValue("disabled");
    mockEnsure.mockResolvedValue("enabled");
    render(<AutostartView settings={{ ...DEFAULT_SETTINGS, autoStart: true }} upd={() => {}} />);
    const fix = await screen.findByTestId("autostart-fix");
    expect(fix.textContent).toContain("Pasang");
    fireEvent.click(fix);
    await waitFor(() => {
      expect(mockEnsure).toHaveBeenCalledWith(true, true);
      expect(screen.getByTestId("autostart-status").textContent).toContain("aktif di OS");
    });
  });

  it("preview (unsupported) -> tanpa tombol, ada keterangan", async () => {
    mockGet.mockResolvedValue("unsupported");
    render(<AutostartView settings={DEFAULT_SETTINGS} upd={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId("autostart-status").textContent).toContain("tidak didukung");
    });
    expect(screen.queryByTestId("autostart-fix")).toBeNull();
  });
});
