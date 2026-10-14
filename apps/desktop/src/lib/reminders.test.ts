import { describe, expect, it } from "vitest";
import { recurrenceLabel, relDue, reminderBadge, splitReminders } from "./reminders";
import type { Reminder } from "./store";

const mk = (over: Partial<Reminder> & { id: string }): Reminder => ({
  title: over.id, dueAt: new Date(Date.now() + 3600_000).toISOString(),
  timezone: "Asia/Jakarta", recurrence: "none", status: "active",
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  ...over,
});

describe("recurrenceLabel", () => {
  it("maps rules to Indonesian labels", () => {
    expect(recurrenceLabel("none")).toBe("Sekali saja");
    expect(recurrenceLabel("daily")).toBe("Setiap hari");
    expect(recurrenceLabel("weekdays")).toBe("Senin–Jumat");
    expect(recurrenceLabel("weekly")).toBe("Setiap minggu");
  });
});

describe("relDue", () => {
  it("formats future and past relatively", () => {
    const now = Date.now();
    expect(relDue(new Date(now + 10 * 60000).toISOString(), now)).toBe("10 mnt lagi");
    expect(relDue(new Date(now + 3 * 3600_000).toISOString(), now)).toBe("3 jam lagi");
    expect(relDue(new Date(now - 5 * 60000).toISOString(), now)).toBe("terlewat 5 mnt");
  });
});

describe("reminderBadge", () => {
  it("flags overdue as warn, snoozed with time", () => {
    const now = Date.now();
    const late = mk({ id: "a", dueAt: new Date(now - 1000).toISOString() });
    expect(reminderBadge(late, now).warn).toBe(true);
    const sn = mk({ id: "b", status: "snoozed", snoozeUntil: new Date(now + 600_000).toISOString() });
    expect(reminderBadge(sn, now).text).toMatch(/^Ditunda s\/d /);
    const act = mk({ id: "c", dueAt: new Date(now + 600_000).toISOString() });
    expect(reminderBadge(act, now)).toEqual({ text: "Aktif", warn: false });
  });
});

describe("splitReminders", () => {
  it("separates upcoming (nearest first) from history (newest first)", () => {
    const now = Date.now();
    const items = [
      mk({ id: "done-old", status: "completed", updatedAt: new Date(now - 2000).toISOString() }),
      mk({ id: "far", dueAt: new Date(now + 7200_000).toISOString() }),
      mk({ id: "near", dueAt: new Date(now + 600_000).toISOString() }),
      mk({ id: "gone", status: "dismissed", updatedAt: new Date(now - 1000).toISOString() }),
    ];
    const { upcoming, history } = splitReminders(items);
    expect(upcoming.map((r) => r.id)).toEqual(["near", "far"]);
    expect(history.map((r) => r.id)).toEqual(["gone", "done-old"]);
  });
});
