import { describe, expect, it, afterEach } from "vitest";
import {
  countOverdue, nudgeSlotKey, nudgeSlotNow, shouldFireTaskNudge,
  tasksNeedingAttention, TASK_NUDGE_SLOTS,
} from "./taskNudge";
import type { Todo } from "./store";

function todo(partial: Partial<Todo> & { id: string }): Todo {
  const t = new Date().toISOString();
  return {
    title: "x", status: "open", priority: 0, createdAt: t, updatedAt: t,
    ...partial,
  };
}

const at = (h: number, m: number) => new Date(2026, 9, 15, h, m, 30);

describe("taskNudge (ritme 13:00 + 17:30)", () => {
  afterEach(() => { localStorage.clear(); });

  it("slot config dua kali sehari", () => {
    expect(TASK_NUDGE_SLOTS).toEqual([
      { h: 13, m: 0, label: "13:00" },
      { h: 17, m: 30, label: "17:30" },
    ]);
  });

  it("di luar slot -> null (tidak nagging tiap tick)", () => {
    const todos = [todo({ id: "a" })];
    expect(nudgeSlotNow(at(9, 0))).toBeNull();
    expect(shouldFireTaskNudge(at(9, 0), todos, null)).toBeNull();
    expect(shouldFireTaskNudge(at(13, 5), todos, null)).toBeNull();
  });

  it("di slot tapi tak ada tugas actionable -> null", () => {
    const done = [todo({ id: "a", status: "completed" })];
    expect(shouldFireTaskNudge(at(13, 0), done, null)).toBeNull();
    // Jatuh tempo besok belum waktunya dicemaskan.
    const future = [todo({ id: "b", dueAt: new Date(2026, 9, 16, 9, 0).toISOString() })];
    expect(tasksNeedingAttention(future, at(13, 0))).toHaveLength(0);
    expect(shouldFireTaskNudge(at(13, 0), future, null)).toBeNull();
  });

  it("di slot + ada terbuka -> bunyi sekali per slot per hari", () => {
    const todos = [
      todo({ id: "a" }), // tanpa deadline ikut
      todo({ id: "b", dueAt: new Date(2026, 9, 15, 9, 0).toISOString() }), // hari ini
      todo({ id: "c", dueAt: new Date(2026, 9, 14, 9, 0).toISOString() }), // overdue
    ];
    const fire = shouldFireTaskNudge(at(13, 0), todos, null);
    expect(fire?.open).toHaveLength(3);
    expect(fire?.key).toBe("2026-10-15@13:00");
    expect(countOverdue(fire!.open, at(13, 0))).toBe(2); // b (09:00) + c (kemarin)
    expect(nudgeSlotKey(at(13, 0), fire!.slot)).toBe(fire!.key);
    // Sudah bunyi slot ini -> diam.
    expect(shouldFireTaskNudge(at(13, 0), todos, fire!.key)).toBeNull();
    // Slot sore hari yang sama -> bunyi lagi (beda key).
    const sore = shouldFireTaskNudge(at(17, 30), todos, fire!.key);
    expect(sore?.key).toBe("2026-10-15@17:30");
  });

  it("deadline korup tetap diingatkan (fail-open)", () => {
    const todos = [todo({ id: "a", dueAt: "bukan-tanggal" })];
    expect(tasksNeedingAttention(todos, at(13, 0))).toHaveLength(1);
  });
});
