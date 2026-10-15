/** Tab Kalender: grid bulanan + tanda pengingat/acara + agenda harian + sinkron-segera. */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";
import { MainPanel } from "./MainPanel";
import { loadSettings, store } from "../lib/store";
import { monthLabel } from "../features/calendar/calendar";

function seedMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const t = new Date().toISOString();
  store.reminders.save([
    {
      id: "r1", title: "Minum obat", dueAt: new Date(y, m, 15, 9, 0).toISOString(),
      timezone: "Asia/Jakarta", recurrence: "none", status: "active",
      createdAt: t, updatedAt: t,
    },
  ]);
  store.events.save([
    {
      id: "e1", title: "Rapat RT", startAt: new Date(y, m, 15, 19, 0).toISOString(),
      endAt: new Date(y, m, 15, 20, 0).toISOString(), source: "local", createdAt: t,
    },
  ]);
}

function renderCalendar() {
  return render(
    <MainPanel tab="calendar" setTab={() => {}} onClose={() => {}}
      settings={loadSettings()} setSettings={() => {}}
      refreshKey={0} bump={() => {}} timerStart={() => {}} timerLeft={null} />
  );
}

describe("MainPanel calendar (bulanan lokal)", () => {
  afterEach(() => { cleanup(); localStorage.clear(); });

  it("grid 42 sel + tanda di tanggal ada pengingat/acara", () => {
    seedMonth();
    renderCalendar();
    const now = new Date();
    expect(screen.getByText(monthLabel(now.getFullYear(), now.getMonth()))).not.toBeNull();
    const cells = screen.getAllByRole("gridcell");
    expect(cells).toHaveLength(42);
    // Sel tgl 15 punya kedua tanda (title gabungan).
    const day15 = cells.find((c) => c.getAttribute("aria-label")?.startsWith("15 "));
    expect(day15?.getAttribute("aria-label")).toContain("1 pengingat");
    expect(day15?.getAttribute("aria-label")).toContain("1 acara");
  });

  it("klik tanggal menampilkan agenda hari itu", () => {
    seedMonth();
    renderCalendar();
    const cells = screen.getAllByRole("gridcell");
    const day15 = cells.find((c) => c.getAttribute("aria-label")?.startsWith("15 "))!;
    fireEvent.click(day15);
    expect(day15.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Minum obat")).not.toBeNull();
    expect(screen.getByText("Rapat RT")).not.toBeNull();
  });

  it("navigasi bulan + tombol sinkron-segera ada", () => {
    seedMonth();
    renderCalendar();
    const now = new Date();
    fireEvent.click(screen.getByTitle("Bulan berikutnya"));
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    expect(screen.getByText(monthLabel(d.getFullYear(), d.getMonth()))).not.toBeNull();
    fireEvent.click(screen.getByText("Hari ini"));
    expect(screen.getByText(monthLabel(now.getFullYear(), now.getMonth()))).not.toBeNull();
    // Sinkron Google: stub "segera hadir", bukan disabled buntu.
    expect(screen.getByTitle("Segera hadir")).not.toBeNull();
    expect(screen.getByText(/Terakhir sinkron: belum pernah/)).not.toBeNull();
  });

  it("tanggal kosong menampilkan pesan kosong", () => {
    seedMonth();
    renderCalendar();
    const cells = screen.getAllByRole("gridcell");
    // Cari sel bulan ini tanpa tanda (tanggal 1, kecil kemungkinan ada data).
    const empty = cells.find(
      (c) => !c.className.includes("dim") && !c.getAttribute("aria-label")?.includes("pengingat") && !c.getAttribute("aria-label")?.includes("acara"),
    )!;
    fireEvent.click(empty);
    expect(screen.getByText("Tidak ada pengingat/acara di tanggal ini.")).not.toBeNull();
  });
});
