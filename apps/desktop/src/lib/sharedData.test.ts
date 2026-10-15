import { describe, expect, it, beforeEach, vi } from "vitest";
import { notifyDataChanged, subscribeDataChanged } from "./sharedData";
import { normalizeCreatedBy, store } from "./store";

beforeEach(() => {
  localStorage.clear();
});

describe("normalizeCreatedBy (info-only, single shared DB)", () => {
  it("mempertahankan id valid, asing -> null (data lama aman)", () => {
    expect(normalizeCreatedBy("main")).toBe("main");
    expect(normalizeCreatedBy("c_abc123")).toBe("c_abc123");
    expect(normalizeCreatedBy(undefined)).toBeNull();
    expect(normalizeCreatedBy(null)).toBeNull();
    expect(normalizeCreatedBy("")).toBeNull();
    expect(normalizeCreatedBy("window-1")).toBeNull();
    expect(normalizeCreatedBy("../../etc")).toBeNull();
    expect(normalizeCreatedBy("c_ABC")).toBeNull();
  });
});

describe("single shared DB: save broadcast ke window lain", () => {
  it("store.reminders.save memicu subscriber lintas window", () => {
    const cb = vi.fn();
    const unsub = subscribeDataChanged("reminders", cb);
    store.reminders.save([
      {
        id: "r1", title: "x", dueAt: new Date().toISOString(),
        timezone: "Asia/Jakarta", recurrence: "none", status: "active",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: "main",
      },
    ]);
    // CustomEvent lokal jalan sinkron.
    expect(cb).toHaveBeenCalledWith("reminders");
    unsub();
  });

  it("storage event dari window lain memicu reload (simulasi)", () => {
    const cb = vi.fn();
    const unsub = subscribeDataChanged("todos", cb);
    window.dispatchEvent(
      new StorageEvent("storage", { key: "deskpet:todos", newValue: "[]" }),
    );
    expect(cb).toHaveBeenCalledWith("todos");
    // Key lain tidak memicu.
    cb.mockClear();
    window.dispatchEvent(
      new StorageEvent("storage", { key: "deskpet:reminders", newValue: "[]" }),
    );
    expect(cb).not.toHaveBeenCalled();
    unsub();
  });

  it("unsubscribe menghentikan callback", () => {
    const cb = vi.fn();
    const unsub = subscribeDataChanged("notes", cb);
    unsub();
    notifyDataChanged("notes");
    expect(cb).not.toHaveBeenCalled();
  });

  it("createdBy tidak mempartisi data: semua window baca daftar yang sama", () => {
    store.notes.save([
      { id: "n1", title: "a", content: "x", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", createdBy: "main" },
      { id: "n2", title: "b", content: "y", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", createdBy: "c_xyz" },
      { id: "n3", title: "c", content: "z", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
    ]);
    // Tidak ada filter owner: semua item terlihat dari window mana pun.
    expect(store.notes.all()).toHaveLength(3);
  });
});
