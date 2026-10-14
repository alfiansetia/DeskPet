/** Regression: tab Log menampilkan audit lokal + bisa dihapus.
 * (Dulu audit menumpuk di bawah Pengaturan.)
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";
import { MainPanel } from "./MainPanel";
import { loadSettings, store, uid } from "../lib/store";

function renderTab(tab: "log" | "settings") {
  return render(
    <MainPanel tab={tab} setTab={() => {}} onClose={() => {}}
      settings={loadSettings()} setSettings={() => {}}
      refreshKey={0} bump={() => {}} timerStart={() => {}} timerLeft={null} />
  );
}

function seedAudit() {
  const t = new Date().toISOString();
  store.audit.push({ id: uid("a"), actionId: "prayer.fetch", source: "prayer", status: "executed", confirmationRequired: false, createdAt: t });
  store.audit.push({ id: uid("a"), actionId: "todo.create", source: "assistant", status: "executed", confirmationRequired: false, createdAt: t });
}

describe("MainPanel log tab", () => {
  afterEach(() => { cleanup(); localStorage.clear(); });

  it("tab Log ada di bar + menampilkan entri audit", () => {
    seedAudit();
    renderTab("log");
    expect(document.querySelector("[title='Log']")).not.toBeNull();
    const list = screen.getByTestId("audit-list");
    expect(list.textContent).toContain("prayer.fetch");
    expect(list.textContent).toContain("todo.create");
  });

  it("tombol Hapus mengosongkan log", () => {
    seedAudit();
    renderTab("log");
    fireEvent.click(screen.getByTitle("Hapus semua log"));
    expect(screen.getByText("Belum ada aktivitas tercatat.")).not.toBeNull();
    expect(store.audit.all()).toHaveLength(0);
  });

  it("tab Pengaturan tidak lagi menumpuk audit", () => {
    seedAudit();
    renderTab("settings");
    expect(document.querySelector("[data-testid='audit-list']")).toBeNull();
  });
});
