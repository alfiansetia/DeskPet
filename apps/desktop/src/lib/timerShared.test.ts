import { describe, expect, it, beforeEach } from "vitest";
import { TIMER_KEY, clearSharedTimer, loadSharedTimer, saveSharedTimer, sharedTimerLeft, type SharedTimer } from "./timerShared";

const base: SharedTimer = { endAt: Date.now() + 60_000, label: "Fokus", durationSecs: 60, startedBy: "main", startedAt: Date.now() };

beforeEach(() => {
  localStorage.clear();
});

describe("timerShared", () => {
  it("roundtrip simpan-muat", () => {
    saveSharedTimer(base);
    expect(loadSharedTimer()).toMatchObject({ label: "Fokus", durationSecs: 60, startedBy: "main" });
  });

  it("menolak data sampah", () => {
    localStorage.setItem(TIMER_KEY, "bukan json");
    expect(loadSharedTimer()).toBeNull();
    localStorage.setItem(TIMER_KEY, JSON.stringify({ label: "x" }));
    expect(loadSharedTimer()).toBeNull();
    localStorage.setItem(TIMER_KEY, JSON.stringify([1, 2]));
    expect(loadSharedTimer()).toBeNull();
  });

  it("timer basi >24 jam dianggap hangus", () => {
    saveSharedTimer({ ...base, endAt: Date.now() - 25 * 3600_000 });
    expect(loadSharedTimer()).toBeNull();
  });

  it("sisa detik dibulatkan dan min 0", () => {
    const now = 1_000_000;
    expect(sharedTimerLeft(null, now)).toBeNull();
    expect(sharedTimerLeft({ ...base, endAt: now + 90_500 }, now)).toBe(91);
    expect(sharedTimerLeft({ ...base, endAt: now - 5_000 }, now)).toBe(0);
  });

  it("clear menghapus timer", () => {
    saveSharedTimer(base);
    clearSharedTimer();
    expect(loadSharedTimer()).toBeNull();
  });
});
