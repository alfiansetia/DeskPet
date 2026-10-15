import { beforeEach, describe, expect, it } from "vitest";
import {
  formatCountdown, getCachedPrayerDay, getInstantPrayerDay, getNextPrayer, getUpcomingReminder,
  toDateForTime, toYMD,
  type PrayerDay,
} from "./prayer";

beforeEach(() => { localStorage.clear(); });

const day: PrayerDay = {
  date: "2026-10-14", cityId: "1301", cityName: "KOTA JAKARTA",
  imsak: "04:06", subuh: "04:16", terbit: "05:29", dhuha: "05:56",
  dzuhur: "11:42", ashar: "14:46", maghrib: "17:49", isya: "18:58",
  source: "myquran",
};

describe("prayer helpers", () => {
  it("toDateForTime parses HH:MM ke tanggal lokal", () => {
    const d = toDateForTime("2026-10-14", "17:49");
    expect(d?.getHours()).toBe(17);
    expect(d?.getMinutes()).toBe(49);
    expect(toDateForTime("2026-10-14", "xx")).toBeNull();
  });

  it("getNextPrayer menemukan Dzuhur di pagi hari", () => {
    const now = new Date(2026, 9, 14, 8, 0, 0);
    const n = getNextPrayer(day, now);
    expect(n?.name).toBe("Dzuhur");
  });

  it("getNextPrayer setelah Isya -> null (besok belum di-load)", () => {
    const now = new Date(2026, 9, 14, 20, 0, 0);
    expect(getNextPrayer(day, now)).toBeNull();
  });

  it("getUpcomingReminder H-10 menit terdeteksi", () => {
    const now = new Date(2026, 9, 14, 17, 42, 0);
    const up = getUpcomingReminder(day, now, 10);
    expect(up?.name).toBe("Maghrib");
  });

  it("getUpcomingReminder mati saat 0", () => {
    const now = new Date(2026, 9, 14, 17, 42, 0);
    expect(getUpcomingReminder(day, now, 0)).toBeNull();
  });

  it("formatCountdown presisi menit tanpa detik", () => {
    expect(formatCountdown(90_000)).toBe("2 mnt");
    expect(formatCountdown(3_661_000)).toBe("1 jam 2 mnt");
    expect(formatCountdown(3_600_000)).toBe("1 jam");
    expect(formatCountdown(0)).toBe("0 mnt");
  });
});

describe("instant boot cache", () => {
  it("getInstantPrayerDay memakai cache lokal hari ini tanpa network", async () => {
    const now = new Date();
    const today = { ...day, date: toYMD(now) };
    localStorage.setItem(`deskpet:prayer:1301:${toYMD(now)}`, JSON.stringify(today));
    const got = await getInstantPrayerDay("1301", now);
    expect(got?.date).toBe(toYMD(now));
    expect(getCachedPrayerDay("1301", now)?.date).toBe(toYMD(now));
  });

  it("tanpa cache sama sekali -> null (backend absen di jsdom, network tidak dipanggil)", async () => {
    const got = await getInstantPrayerDay("1301", new Date());
    expect(got).toBeNull();
  });
});
