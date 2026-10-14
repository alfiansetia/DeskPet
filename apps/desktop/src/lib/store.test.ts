import { describe, expect, it, beforeEach } from "vitest";
import { exportBackup, importBackup, store } from "./store";

beforeEach(() => { localStorage.clear(); });

describe("store backup/restore", () => {
  it("exports valid DeskPet JSON", () => {
    const json = exportBackup();
    const d = JSON.parse(json);
    expect(d.app).toBe("deskpet");
    expect(Array.isArray(d.todos)).toBe(true);
  });
  it("round-trips todos", () => {
    store.todos.save([{ id: "t1", title: "x", status: "open", priority: 0, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }]);
    const json = exportBackup();
    localStorage.clear();
    const r = importBackup(json);
    expect(r.ok).toBe(true);
    expect(store.todos.all().length).toBe(1);
  });
  it("rejects foreign files", () => {
    expect(importBackup('{"app":"other"}').ok).toBe(false);
    expect(importBackup("not json").ok).toBe(false);
  });
});
