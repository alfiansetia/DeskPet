/** Restart: primary membuka kembali window sekunder yang tersimpan. */
import { cleanup, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((cmd: string) => {
    if (cmd === "pet_get_state_of" || cmd === "pet_get_state") return Promise.resolve("idle");
    if (cmd === "pet_is_visible") return Promise.resolve(true);
    if (cmd === "frontend_settings_get") return Promise.resolve(null);
    return Promise.resolve({ ok: true });
  }),
}));

import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import { addCompanion, loadCompanions, MAIN_COMPANION_ID } from "./lib/store";

const spawnCalls = () =>
  vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === "companions_spawn");

describe("App restore companions on boot", () => {
  afterEach(() => { cleanup(); localStorage.clear(); vi.mocked(invoke).mockClear(); });

  it("primary spawn semua sekunder, lewati main", async () => {
    expect(loadCompanions()).toHaveLength(1); // migrasi: hanya main
    const added = addCompanion({ species: "frog", paletteId: "rose", role: "all" });
    expect(added).not.toBeNull();
    render(<App />);
    await waitFor(() => {
      expect(spawnCalls().some(([, args]) => (args as { id?: string })?.id === added!.id)).toBe(true);
    });
    expect(spawnCalls().some(([, args]) => (args as { id?: string })?.id === MAIN_COMPANION_ID)).toBe(false);
  });

  it("tanpa sekunder: tidak ada spawn", async () => {
    expect(loadCompanions()).toHaveLength(1);
    render(<App />);
    // Beri kesempatan effect jalan; tetap harus nol spawn.
    await new Promise((r) => setTimeout(r, 100));
    expect(spawnCalls()).toHaveLength(0);
  });
});
