import { describe, expect, it } from "vitest";
import {
  parseCommand, runNotesSearch, runTasksQuery, validateAction,
  type AssistContext,
} from "./parser";
import type { Note, Reminder, Todo } from "../../lib/store";

describe("parseCommand (deterministic local)", () => {
  it("reminder ID", () => {
    const p = parseCommand("ingatkan saya deploy besok jam 9 pagi");
    expect(p.action.type).toBe("reminder.create");
    if (p.action.type === "reminder.create") {
      expect(p.action.title.toLowerCase()).toContain("deploy");
      expect(validateAction(p.action).ok).toBe(true);
    }
  });
  it("todo EN", () => {
    const p = parseCommand("add buy groceries to my to-do list");
    expect(p.action.type).toBe("todo.create");
  });
  it("timer", () => {
    const p = parseCommand("timer 25 menit");
    expect(p.action.type).toBe("timer.start");
    if (p.action.type === "timer.start") expect(p.action.durationSeconds).toBe(1500);
  });
  it("asks for time when missing", () => {
    const p = parseCommand("ingatkan saya sesuatu");
    expect(p.action.type).toBe("unknown");
    expect(p.preview).toMatch(/Kapan/);
  });
  it("email intent never auto-executes", () => {
    const p = parseCommand("kirim email ke tim");
    expect(p.permission).toBe("external_write");
    expect(p.needsConfirm).toBe(true);
  });
  it("validation rejects empty title", () => {
    expect(validateAction({ type: "todo.create", title: "  " }).ok).toBe(false);
  });
  it("processed locally always true", () => {
    expect(parseCommand("halo").processedLocally).toBe(true);
  });
});

function todo(id: string, title: string, status: Todo["status"] = "open", dueAt?: string): Todo {
  return {
    id, title, status, priority: 0, dueAt: dueAt ?? null,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function reminder(id: string, title: string, status: Reminder["status"] = "active"): Reminder {
  return {
    id, title, dueAt: "2026-10-20T09:00:00.000Z", timezone: "Asia/Jakarta",
    recurrence: "none", status, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function note(id: string, title: string, content: string, deletedAt?: string): Note {
  return {
    id, title, content, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: deletedAt ?? null,
  };
}

const CTX: AssistContext = {
  reminders: [reminder("r1", "Rapat tim mingguan"), reminder("r2", "Bayar listrik")],
  todos: [todo("t1", "Beli susu"), todo("t2", "Beli susu coklat"), todo("t3", "Deploy aplikasi", "completed")],
  notes: [note("n1", "Belanja", "susu telur roti"), note("n2", "Ide", "aplikasi catatan")],
};

describe("parseCommand kemampuan lokal baru", () => {
  it("todo.complete cocok satu -> konfirmasi", () => {
    const ctx: AssistContext = { ...CTX, todos: [todo("t1", "Beli susu stroberi")] };
    const p = parseCommand("selesaikan tugas beli stroberi", new Date(), ctx);
    expect(p.action.type).toBe("todo.complete");
    expect(p.needsConfirm).toBe(true);
    if (p.action.type === "todo.complete") {
      expect(p.action.todoId).toBe("t1");
      expect(validateAction(p.action).ok).toBe(true);
    }
  });

  it("todo.complete multi-cocok -> minta spesifik", () => {
    const p = parseCommand("selesaikan tugas beli susu", new Date(), CTX);
    expect(p.action.type).toBe("unknown");
    expect(p.preview).toMatch(/lebih spesifik/);
  });

  it("todo.complete tak cocok -> unknown", () => {
    const p = parseCommand("selesaikan tugas ke bulan", new Date(), CTX);
    expect(p.action.type).toBe("unknown");
    expect(p.preview).toMatch(/Tidak ada/);
  });

  it("kalimat pengingat contenant 'selesai' tetap jadi reminder", () => {
    const p = parseCommand("ingatkan saya setelah selesai rapat jam 5 sore", new Date("2026-10-15T12:00:00"), CTX);
    expect(p.action.type).toBe("reminder.create");
  });

  it("todo.delete cocok satu -> konfirmasi permanen", () => {
    const ctx: AssistContext = { ...CTX, todos: [todo("t9", "Beli payung")] };
    const p = parseCommand("hapus tugas payung", new Date(), ctx);
    expect(p.action.type).toBe("todo.delete");
    expect(p.needsConfirm).toBe(true);
    expect(p.preview).toMatch(/permanen/);
  });

  it("note.delete + arsip (soft delete)", () => {
    const p = parseCommand("hapus catatan belanja", new Date(), CTX);
    expect(p.action.type).toBe("note.delete");
    if (p.action.type === "note.delete") expect(p.action.noteId).toBe("n1");
  });

  it("reminder.snooze pakai durasi, default 10 menit", () => {
    const p = parseCommand("tunda pengingat rapat 10 menit", new Date("2026-10-15T12:00:00.000Z"), CTX);
    expect(p.action.type).toBe("reminder.snooze");
    if (p.action.type === "reminder.snooze") {
      expect(p.action.reminderId).toBe("r1");
      expect(p.action.snoozeUntil).toBe("2026-10-15T12:10:00.000Z");
      expect(validateAction(p.action).ok).toBe(true);
    }
    const d = parseCommand("tunda bayar listrik", new Date("2026-10-15T12:00:00.000Z"), CTX);
    if (d.action.type !== "reminder.snooze") throw new Error("harusnya snooze");
    expect(d.action.snoozeUntil).toBe("2026-10-15T12:10:00.000Z");
  });

  it("notes.search dan cari tugas", () => {
    const s = parseCommand("cari catatan belanja", new Date(), CTX);
    expect(s.action.type).toBe("notes.search");
    const t = parseCommand("cari tugas susu", new Date(), CTX);
    expect(t.action.type).toBe("tasks.query");
    if (t.action.type === "tasks.query") {
      expect(t.action.scope).toBe("all");
      expect(t.action.keyword).toBe("susu");
    }
  });

  it("tasks.query overdue/all/today", () => {
    expect(parseCommand("tugas menumpuk", new Date(), CTX).action.type).toBe("tasks.query");
    const all = parseCommand("tampilkan semua tugas", new Date(), CTX);
    expect(all.action.type).toBe("tasks.query");
    if (all.action.type === "tasks.query") expect(all.action.scope).toBe("all");
    const today = parseCommand("tugas apa hari ini", new Date(), CTX);
    expect(today.action.type).toBe("tasks.query");
    if (today.action.type === "tasks.query") {
      expect(today.action.scope).toBe("today");
      expect(validateAction(today.action).ok).toBe(true); // dulu ditolak allowlist
    }
  });

  it("ntfy.send perlu topik + pesan, selalu konfirmasi", () => {
    const p = parseCommand("kirim notif ke topik cobaKu123: halo dunia", new Date(), CTX);
    expect(p.action.type).toBe("ntfy.send");
    expect(p.needsConfirm).toBe(true);
    expect(p.permission).toBe("external_write");
    if (p.action.type === "ntfy.send") {
      expect(p.action.topic).toBe("cobaKu123");
      expect(p.action.message).toContain("halo dunia");
      expect(validateAction(p.action).ok).toBe(true);
    }
  });

  it("ntfy tanpa pesan -> unknown", () => {
    const p = parseCommand("kirim notif ke topik cobaKu123", new Date(), CTX);
    expect(p.action.type).toBe("unknown");
  });
});

describe("runTasksQuery / runNotesSearch (murni)", () => {
  const todos = [
    todo("t1", "Beli susu", "open", "2026-10-15T08:00:00.000Z"),
    todo("t2", "Bayar listrik", "open", "2026-10-10T08:00:00.000Z"),
    todo("t3", "Selesai kemarin", "completed", "2026-10-14T08:00:00.000Z"),
  ];
  it("today/overdue/all + keyword", () => {
    expect(runTasksQuery(todos, "overdue").toLowerCase()).toContain("bayar listrik");
    expect(runTasksQuery(todos, "all", "susu")).toContain("Beli susu");
    expect(runTasksQuery([], "all")).toMatch(/Tidak ada/);
  });

  it("notes.search hormati arsip + kosong", () => {
    const notes = [note("n1", "Belanja", "susu telur"), note("n2", "Lama", "susu basi", "2026-01-02T00:00:00.000Z")];
    expect(runNotesSearch(notes, "susu")).toContain("Belanja");
    expect(runNotesSearch(notes, "susu")).not.toContain("Lama");
    expect(runNotesSearch(notes, "zzz")).toMatch(/Tidak ada/);
  });
});
