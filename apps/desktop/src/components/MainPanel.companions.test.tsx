/** Multi-pet B: kelola companion dari tab Kawan (tambah/role/hapus). */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";
import { MainPanel } from "./MainPanel";
import { loadCompanions, loadSettings, store } from "../lib/store";

function renderCompanions() {
  return render(
    <MainPanel tab="companions" setTab={() => {}} onClose={() => {}}
      settings={loadSettings()} setSettings={() => {}}
      refreshKey={0} bump={() => {}} timerStart={() => {}} timerLeft={null} />
  );
}

describe("MainPanel companions (multi-pet B)", () => {
  afterEach(() => { cleanup(); localStorage.clear(); });

  it("tab Kawan ada di barisan tab + menampilkan 1 companion utama hasil migrasi", () => {
    renderCompanions();
    expect(screen.getByTitle("Kawan")).not.toBeNull();
    expect(screen.getByTestId("companions-field")).not.toBeNull();
    expect(loadCompanions()).toHaveLength(1);
    expect(screen.getByTestId("companions-list").textContent).toContain("Kucing");
  });

  it("tambah companion -> masuk daftar + tersimpan", async () => {
    renderCompanions();
    fireEvent.click(screen.getByTitle("Tambah karakter (window baru)"));
    await waitFor(() => {
      expect(loadCompanions()).toHaveLength(2);
    });
    expect(screen.getByTestId("companions-list").children.length).toBe(2);
  });

  it("ganti role tersimpan dan berlaku", async () => {
    renderCompanions();
    fireEvent.click(screen.getByTitle("Tambah karakter (window baru)"));
    await waitFor(() => expect(loadCompanions()).toHaveLength(2));
    const selects = screen.getAllByLabelText(/Tugas /);
    fireEvent.change(selects[1], { target: { value: "prayer" } });
    expect(loadCompanions()[1].role).toBe("prayer");
  });

  it("toggle pill suhu/mini via Pengaturan window pet itu", () => {
    render(
      <MainPanel tab="settings" setTab={() => {}} onClose={() => {}}
        settings={loadSettings()} setSettings={() => {}}
        refreshKey={0} bump={() => {}} timerStart={() => {}} timerLeft={null} />
    );
    const box = screen.getByTitle("Tampilkan pill suhu di pet ini").querySelector("input")!;
    fireEvent.click(box);
    expect(loadCompanions()[0].showTemp).toBe(false);
    const mini = screen.getByTitle("Tampilkan pill countdown sholat di pet ini").querySelector("input")!;
    fireEvent.click(mini);
    expect(loadCompanions()[0].showMini).toBe(false);
  });

  it("toggle pemalu via Pengaturan window pet itu (cermin tab Kawan)", () => {
    render(
      <MainPanel tab="settings" setTab={() => {}} onClose={() => {}}
        settings={loadSettings()} setSettings={() => {}}
        refreshKey={0} bump={() => {}} timerStart={() => {}} timerLeft={null} />
    );
    const box = screen.getByLabelText(/kabur saat di-hover/);
    fireEvent.click(box);
    expect(loadCompanions()[0].shy).toBe(true);
  });
  it("tombol Jinakkan semua mematikan pemalu semua karakter", () => {
    renderCompanions();
    expect(screen.queryByRole("button", { name: /Jinakkan semua/ })).toBeNull(); // tak ada yang pemalu
    const boxes = screen.getAllByLabelText("Pemalu");
    fireEvent.click(boxes[0]);
    expect(loadCompanions()[0].shy).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Jinakkan semua/ }));
    expect(loadCompanions().every((c) => c.shy !== true)).toBe(true);
    expect(screen.queryByRole("button", { name: /Jinakkan semua/ })).toBeNull();
  });
  it("tab Kawan hanya manage: tanpa kontrol tampilan per kartu", () => {
    renderCompanions();
    // Spesies/warna/ukuran/pill per kartu diatur via dobel-klik pet → Pengaturan.
    // (Form "tambah" di bawah tetap punya dropdown spesies/warna — itu bagian manage.)
    const cards = screen.getByTestId("companions-list");
    expect(within(cards).queryByLabelText(/Spesies /)).toBeNull();
    expect(within(cards).queryByLabelText(/Warna /)).toBeNull();
    expect(within(cards).queryByTitle("Tampilkan pill suhu di pet ini")).toBeNull();
    // Yang tersisa per kartu: tugas (role). Tambah/hapus tetap ada.
    expect(within(cards).getByLabelText(/Tugas /)).not.toBeNull();
    expect(screen.getByTitle("Tambah karakter (window baru)")).not.toBeNull();
  });

  it("companion utama tidak bisa dihapus", () => {
    renderCompanions();
    // Hanya ada tombol trash untuk non-utama; dengan 1 item tidak ada tombol hapus.
    expect(screen.queryByTitle("Tutup window + hapus karakter ini")).toBeNull();
    expect(store.companions.all()).toHaveLength(1);
  });
});
