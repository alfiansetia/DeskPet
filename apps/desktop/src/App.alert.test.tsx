/** Regression: alert penting tampil SATU (bubble atas, clickable) —
 * toast kiri untuk kind reminder tidak dirender (dulu dobel).
 * Diuji lewat alur nyata: pengingat jatuh tempo -> scheduler tick -> bubble.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import App from "./App";
import { toast } from "./lib/notify";

function seedDueReminder() {
  const t = new Date(Date.now() - 60_000).toISOString();
  localStorage.setItem("deskpet:reminders", JSON.stringify([{
    id: "r_due", title: "Minum obat", dueAt: t, timezone: "Asia/Jakarta",
    recurrence: "none", status: "active", createdAt: t, updatedAt: t,
  }]));
}

describe("App single alert", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

  it("pengingat jatuh tempo -> hanya bubble (tanpa toast kiri)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    seedDueReminder();
    render(<App />);
    await screen.findByTestId("alert-bubble", undefined, { timeout: 5000 });
    expect(document.querySelector(".dp-toast")).toBeNull();
    expect(document.querySelector(".dp-toasts")?.children.length ?? 0).toBe(0);
  });

  it("toast info biasa tetap tampil di kiri", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<App />);
    act(() => { toast("Timer dimulai", "25 menit", "info"); });
    const el = await screen.findByText("Timer dimulai");
    expect(el.closest(".dp-toast")).not.toBeNull();
    expect(document.querySelector("[data-testid='alert-bubble']")).toBeNull();
  });
});
