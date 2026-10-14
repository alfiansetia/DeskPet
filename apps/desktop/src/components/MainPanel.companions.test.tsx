/** Multi-pet B: kelola companion dari tab Pengaturan (tambah/role/hapus). */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";
import { MainPanel } from "./MainPanel";
import { loadCompanions, loadSettings, store } from "../lib/store";

function renderSettings() {
  return render(
    <MainPanel tab="settings" setTab={() => {}} onClose={() => {}}
      settings={loadSettings()} setSettings={() => {}}
      refreshKey={0} bump={() => {}} timerStart={() => {}} timerLeft={null} />
  );
}

describe("MainPanel companions (multi-pet B)", () => {
  afterEach(() => { cleanup(); localStorage.clear(); });

  it("menampilkan 1 companion utama hasil migrasi", () => {
    renderSettings();
    expect(screen.getByTestId("companions-field")).not.toBeNull();
    expect(loadCompanions()).toHaveLength(1);
    expect(screen.getByTestId("companions-list").textContent).toContain("Kucing");
  });

  it("tambah companion -> masuk daftar + tersimpan", async () => {
    renderSettings();
    fireEvent.click(screen.getByTitle("Tambah karakter (window baru)"));
    await waitFor(() => {
      expect(loadCompanions()).toHaveLength(2);
    });
    expect(screen.getByTestId("companions-list").children.length).toBe(2);
  });

  it("ganti role tersimpan dan berlaku", async () => {
    renderSettings();
    fireEvent.click(screen.getByTitle("Tambah karakter (window baru)"));
    await waitFor(() => expect(loadCompanions()).toHaveLength(2));
    const selects = screen.getAllByLabelText(/Tugas /);
    fireEvent.change(selects[1], { target: { value: "prayer" } });
    expect(loadCompanions()[1].role).toBe("prayer");
  });

  it("toggle pill suhu/mini tersimpan per-companion", async () => {
    renderSettings();
    fireEvent.click(screen.getByTitle("Tambah karakter (window baru)"));
    await waitFor(() => expect(loadCompanions()).toHaveLength(2));
    const boxes = screen.getAllByTitle("Tampilkan pill suhu di pet ini");
    fireEvent.click(boxes[1].querySelector("input")!);
    expect(loadCompanions()[1].showTemp).toBe(false);
    // companion pertama tidak ikut mati
    expect(loadCompanions()[0].showTemp).toBe(true);
  });

  it("companion utama tidak bisa dihapus", () => {
    renderSettings();
    // Hanya ada tombol trash untuk non-utama; dengan 1 item tidak ada tombol hapus.
    expect(screen.queryByTitle("Tutup window + hapus karakter ini")).toBeNull();
    expect(store.companions.all()).toHaveLength(1);
  });
});
