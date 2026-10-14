import { describe, expect, it } from "vitest";
import { parseCommand, validateAction } from "./parser";

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
