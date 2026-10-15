import { describe, expect, it, vi } from "vitest";
import {
  checkForUpdates, compareVersions, parseUpdateFile, RELEASES_URL,
} from "./updater";

describe("parseUpdateFile", () => {
  it("valid lolos (notes/url opsional)", () => {
    expect(parseUpdateFile({ version: "0.2.0" })).toEqual({ version: "0.2.0", notes: undefined, url: undefined });
    expect(parseUpdateFile({ version: "1.0.0", notes: "baru", url: RELEASES_URL }))
      .toMatchObject({ version: "1.0.0", notes: "baru" });
  });

  it("invalid -> null, tak pernah throw", () => {
    expect(parseUpdateFile(null)).toBeNull();
    expect(parseUpdateFile("0.2.0")).toBeNull();
    expect(parseUpdateFile([])).toBeNull();
    expect(parseUpdateFile({})).toBeNull();
    expect(parseUpdateFile({ version: "v1" })).toBeNull();
    expect(parseUpdateFile({ version: "1.0" })).toBeNull();
    expect(parseUpdateFile({ version: 123 })).toBeNull();
    // url non-http dibuang tapi versi tetap valid
    expect(parseUpdateFile({ version: "1.0.0", url: "javascript:x" })?.url).toBeUndefined();
  });
});

describe("compareVersions", () => {
  it("banding mayor/minor/patch", () => {
    expect(compareVersions("0.1.0", "0.2.0")).toBe(-1);
    expect(compareVersions("0.2.0", "0.1.0")).toBe(1);
    expect(compareVersions("0.1.0", "0.1.0")).toBe(0);
    expect(compareVersions("0.9.9", "0.10.0")).toBe(-1);
    expect(compareVersions("1.0.0", "0.99.99")).toBe(1);
  });

  it("invalid -> null", () => {
    expect(compareVersions("x", "0.1.0")).toBeNull();
    expect(compareVersions("0.1.0", "y")).toBeNull();
  });
});

describe("checkForUpdates (mock network)", () => {
  const okFetch = (json: unknown, status = 200) =>
    vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => json });

  it("versi baru tersedia -> update", async () => {
    vi.stubGlobal("fetch", okFetch({ version: "0.2.0", notes: "baru", url: RELEASES_URL }));
    try {
      const r = await checkForUpdates("0.1.0", "https://contoh.id/v.json");
      expect(r.state).toBe("update");
      if (r.state === "update") expect(r.latest.version).toBe("0.2.0");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sama/lebih baru -> latest", async () => {
    vi.stubGlobal("fetch", okFetch({ version: "0.1.0" }));
    try {
      expect((await checkForUpdates("0.1.0", "https://contoh.id/v.json")).state).toBe("latest");
    } finally {
      vi.unstubAllGlobals();
    }
    vi.stubGlobal("fetch", okFetch({ version: "0.0.9" }));
    try {
      expect((await checkForUpdates("0.1.0", "https://contoh.id/v.json")).state).toBe("latest");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("HTTP error / invalid / offline -> error tanpa throw", async () => {
    vi.stubGlobal("fetch", okFetch(null, 404));
    try {
      const r = await checkForUpdates("0.1.0", "https://contoh.id/v.json");
      expect(r.state).toBe("error");
    } finally {
      vi.unstubAllGlobals();
    }
    vi.stubGlobal("fetch", okFetch({ versi: "rusak" }));
    try {
      expect((await checkForUpdates("0.1.0", "https://contoh.id/v.json")).state).toBe("error");
    } finally {
      vi.unstubAllGlobals();
    }
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    try {
      const r = await checkForUpdates("0.1.0", "https://contoh.id/v.json");
      expect(r.state).toBe("error");
      if (r.state === "error") expect(r.error).toContain("offline");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
