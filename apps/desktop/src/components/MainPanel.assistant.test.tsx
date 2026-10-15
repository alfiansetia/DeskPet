/** execute() asisten: aksi lokal baru (complete/delete/snooze/query/search/send). */
import { describe, expect, it, afterEach, vi } from "vitest";
import { execute } from "./MainPanel";
import { store } from "../lib/store";

const T = "2026-10-15T12:00:00.000Z";

describe("execute aksi lokal", () => {
  afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

  it("todo.complete menandai selesai", async () => {
    store.todos.save([{
      id: "t1", title: "Beli susu", status: "open", priority: 0,
      createdAt: T, updatedAt: T,
    }]);
    const r = await execute({ type: "todo.complete", todoId: "t1", title: "Beli susu" }, vi.fn());
    expect(r).toBeNull();
    expect(store.todos.all()[0].status).toBe("completed");
    expect(store.todos.all()[0].completedAt).toBeTruthy();
  });

  it("todo.delete menghapus permanen; id hilang -> pesan", async () => {
    store.todos.save([{
      id: "t1", title: "Beli susu", status: "open", priority: 0,
      createdAt: T, updatedAt: T,
    }]);
    await execute({ type: "todo.delete", todoId: "t1", title: "Beli susu" }, vi.fn());
    expect(store.todos.all()).toHaveLength(0);
    const miss = await execute({ type: "todo.delete", todoId: "x", title: "y" }, vi.fn());
    expect(miss).toMatch(/tidak ada/);
  });

  it("note.delete = arsip (deletedAt), bukan hapus fisik", async () => {
    store.notes.save([{ id: "n1", title: "Belanja", content: "susu", createdAt: T, updatedAt: T }]);
    await execute({ type: "note.delete", noteId: "n1", title: "Belanja" }, vi.fn());
    const n = store.notes.all()[0];
    expect(n.deletedAt).toBeTruthy();
  });

  it("reminder.snooze set snoozeUntil", async () => {
    store.reminders.save([{
      id: "r1", title: "Rapat", dueAt: T, timezone: "Asia/Jakarta",
      recurrence: "none", status: "active", createdAt: T, updatedAt: T,
    }]);
    await execute({ type: "reminder.snooze", reminderId: "r1", title: "Rapat", snoozeUntil: "2026-10-15T12:10:00.000Z" }, vi.fn());
    expect(store.reminders.all()[0].snoozeUntil).toBe("2026-10-15T12:10:00.000Z");
  });

  it("tasks.query + notes.search kembalikan teks", async () => {
    store.todos.save([{
      id: "t1", title: "Beli susu", status: "open", priority: 0,
      createdAt: T, updatedAt: T,
    }]);
    const q = await execute({ type: "tasks.query", scope: "all" }, vi.fn());
    expect(q).toContain("Beli susu");
    store.notes.save([{ id: "n1", title: "Belanja", content: "susu telur", createdAt: T, updatedAt: T }]);
    const s = await execute({ type: "notes.search", keyword: "telur" }, vi.fn());
    expect(s).toContain("Belanja");
  });

  it("timer.start panggil timerStart, return null", async () => {
    const start = vi.fn();
    const r = await execute({ type: "timer.start", durationSeconds: 60, label: "Fokus" }, start);
    expect(r).toBeNull();
    expect(start).toHaveBeenCalledWith(60, "Fokus");
  });

  it("ntfy.send POST title+body; gagal -> string error", async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", spy);
    const r = await execute(
      { type: "ntfy.send", topic: "topikx", title: "Halo", message: "dunia" },
      vi.fn(),
    );
    expect(r).toContain("topikx");
    expect(spy.mock.calls[0][0]).toBe("https://ntfy.sh/topikx");
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Title).toBe("Halo");
    expect(init.body).toBe("dunia");
  });

  it("ntfy.send HTTP error/offline -> string, tak pernah throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const r = await execute(
      { type: "ntfy.send", topic: "topikx", title: "H", message: "m" },
      vi.fn(),
    );
    expect(r).toContain("HTTP 500");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const r2 = await execute(
      { type: "ntfy.send", topic: "topikx", title: "H", message: "m" },
      vi.fn(),
    );
    expect(r2).toMatch(/offline|Gagal/);
  });
});
