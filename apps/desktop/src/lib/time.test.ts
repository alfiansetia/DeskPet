import { describe, expect, it } from "vitest";
import { parseNaturalDateTime, parseDurationSeconds, nextOccurrence, isQuietHours } from "./time";

describe("parseNaturalDateTime (ID+EN)", () => {
  const base = new Date("2026-10-14T10:00:00");
  it("parses 'besok jam 9 pagi'", () => {
    const d = parseNaturalDateTime("ingatkan saya rapat besok jam 9 pagi", base);
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(15);
    expect(d!.getHours()).toBe(9);
  });
  it("parses 'jam 4 sore' as 16:00", () => {
    const d = parseNaturalDateTime("ingatkan deploy jam 4 sore", base);
    expect(d).not.toBeNull();
    expect(d!.getHours()).toBe(16);
  });
  it("rolls past time to tomorrow", () => {
    const d = parseNaturalDateTime("ingatkan x jam 8 pagi", base);
    expect(d!.getDate()).toBe(15); // 08:00 already passed at 10:00
  });
  it("parses relative 'dalam 25 menit'", () => {
    const d = parseNaturalDateTime("timer dalam 25 menit", base);
    expect(d!.getMinutes()).toBe(25);
  });
  it("parses weekday 'senin jam 9'", () => {
    const d = parseNaturalDateTime("jadwal senin jam 9", base); // base is Wed
    expect(d!.getDay()).toBe(1);
    expect(d!.getTime()).toBeGreaterThan(base.getTime());
  });
  it("returns null for nonsense", () => {
    expect(parseNaturalDateTime("halo apa kabar", base)).toBeNull();
  });
});

describe("parseDurationSeconds", () => {
  it("parses minutes/hours", () => {
    expect(parseDurationSeconds("25 menit")).toBe(1500);
    expect(parseDurationSeconds("1 jam 30 menit")).toBe(5400);
  });
  it("rejects invalid", () => {
    expect(parseDurationSeconds("halo")).toBeNull();
    expect(parseDurationSeconds("0 menit")).toBeNull();
  });
});

describe("recurrence + quiet hours", () => {
  it("daily advances 1 day", () => {
    const n = nextOccurrence(new Date("2026-10-14T09:00:00"), "daily")!;
    expect(n.getDate()).toBe(15);
  });
  it("weekdays skips weekend", () => {
    const fri = new Date("2026-10-16T09:00:00"); // Friday
    const n = nextOccurrence(fri, "weekdays")!;
    expect(n.getDay()).toBe(1); // Monday
  });
  it("quiet hours default 22-7", () => {
    expect(isQuietHours(new Date("2026-10-14T23:00:00"))).toBe(true);
    expect(isQuietHours(new Date("2026-10-14T12:00:00"))).toBe(false);
  });
});
