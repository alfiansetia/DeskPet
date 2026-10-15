import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPollUrl, fetchPoll, normalizeApiWatch, parsePollResponse,
  selectNewItems, testEndpoint,
} from "./apiwatch";

beforeEach(() => { localStorage.clear(); });

describe("normalizeApiWatch (endpoint dari cache, tanpa hardcode URL)", () => {
  it("default aman: mati, URL kosong (belum dikonfigurasi)", () => {
    const c = normalizeApiWatch({});
    expect(c.enabled).toBe(false);
    expect(c.intervalSecs).toBe(60);
    expect(c.baseUrl).toBe("");
    expect(c.lastSeenId).toBeNull();
  });

  it("clamp interval 30..3600", () => {
    expect(normalizeApiWatch({ intervalSecs: 5 }).intervalSecs).toBe(30);
    expect(normalizeApiWatch({ intervalSecs: 99999 }).intervalSecs).toBe(3600);
    expect(normalizeApiWatch({ intervalSecs: 120 }).intervalSecs).toBe(120);
  });

  it("URL kosong / non-http -> tetap kosong (jangan fetch)", () => {
    expect(normalizeApiWatch({ baseUrl: "" }).baseUrl).toBe("");
    expect(normalizeApiWatch({ baseUrl: "ftp://x" }).baseUrl).toBe("");
    expect(normalizeApiWatch({ baseUrl: "javascript:alert(1)" }).baseUrl).toBe("");
    const ok = normalizeApiWatch({ baseUrl: "https://contoh.id/api/notif/" });
    expect(ok.baseUrl).toBe("https://contoh.id/api/notif"); // trailing slash dipangkas
  });

  it("fetchPoll tanpa endpoint -> gagal cepat tanpa network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const r = await fetchPoll(normalizeApiWatch({ enabled: true }));
      expect(r.ok).toBe(false);
      expect(r.error).toBe("endpoint belum diisi");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("testEndpoint tanpa endpoint -> pesan isi dulu", async () => {
    const r = await testEndpoint("");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("isi endpoint dulu");
  });
});

describe("buildPollUrl", () => {
  it("tanpa cursor -> URL bersih", () => {
    expect(buildPollUrl("https://a.id/poll/", null)).toBe("https://a.id/poll");
  });
  it("dengan cursor -> ?since_id=", () => {
    expect(buildPollUrl("https://a.id/poll", 17)).toBe("https://a.id/poll?since_id=17");
  });
  it("hormati query bawaan", () => {
    expect(buildPollUrl("https://a.id/poll?token=x", 17)).toBe("https://a.id/poll?token=x&since_id=17");
  });
});

describe("parsePollResponse (kontrak mapwho)", () => {
  const sample = {
    data: [{
      id: 18, type: "do_baru", title: "⚠️ Ada DO Baru!, CENT/OUT/17654",
      body: "SO : SO16372 ...", do_name: "CENT/OUT/17654",
      status: "success", sent_at: "2026-10-14T07:08:01.000000Z",
    }],
    latest_id: 18, count: 1, has_more: false,
  };

  it("ambil title/body + latest_id", () => {
    const p = parsePollResponse(sample);
    expect(p.items).toHaveLength(1);
    expect(p.items[0]).toMatchObject({ id: 18, title: "⚠️ Ada DO Baru!, CENT/OUT/17654" });
    expect(p.latestId).toBe(18);
    expect(p.count).toBe(1);
  });

  it("kosong (since_id=latest) -> nol item", () => {
    const p = parsePollResponse({ data: [], latest_id: 18, count: 0, has_more: false });
    expect(p.items).toEqual([]);
    expect(p.latestId).toBe(18);
  });

  it("item rusak dilewat, tak pernah throw", () => {
    const p = parsePollResponse({ data: [{ id: "x" }, null, { id: 5, title: "T", body: "B" }], latest_id: 5 });
    expect(p.items).toEqual([{ id: 5, title: "T", body: "B", type: undefined, sentAt: undefined }]);
    expect(parsePollResponse("sampah")).toEqual({ items: [], latestId: null, count: 0 });
    expect(parsePollResponse(null)).toEqual({ items: [], latestId: null, count: 0 });
  });
});

describe("selectNewItems (cursor lastSeenId)", () => {
  it("belum baseline (null) -> tidak ada yang 'baru' (anti-spam 18 notif)", () => {
    const p = parsePollResponse({ data: [{ id: 1, title: "A", body: "b" }], latest_id: 1 });
    expect(selectNewItems(p, null)).toEqual([]);
  });
  it("hanya id > cursor", () => {
    const p = parsePollResponse({
      data: [{ id: 17, title: "A", body: "a" }, { id: 18, title: "B", body: "b" }],
      latest_id: 18,
    });
    expect(selectNewItems(p, 17).map((i) => i.id)).toEqual([18]);
    expect(selectNewItems(p, 18)).toEqual([]);
  });
});

describe("fetchPoll / testEndpoint (mock network)", () => {
  const cfg = normalizeApiWatch({ enabled: true, baseUrl: "https://a.id/poll", lastSeenId: 17 });

  it("sukses: URL membawa since_id", async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: [{ id: 18, title: "T", body: "B" }], latest_id: 18, count: 1 }),
    });
    vi.stubGlobal("fetch", spy);
    try {
      const r = await fetchPoll(cfg);
      expect(r.ok).toBe(true);
      expect(spy.mock.calls[0][0]).toBe("https://a.id/poll?since_id=17");
      expect(r.parsed.items.map((i) => i.id)).toEqual([18]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("HTTP error -> ok:false tanpa throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }));
    try {
      const r = await fetchPoll(cfg);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("HTTP 500");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("offline -> ok:false tanpa throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    try {
      const r = await fetchPoll(cfg);
      expect(r.ok).toBe(false);
      expect(r.httpStatus).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("testEndpoint tidak butuh cursor + kembalikan preview", async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: [{ id: 18, title: "DO Baru", body: "isi panjang" }], latest_id: 18, count: 1 }),
    });
    vi.stubGlobal("fetch", spy);
    try {
      const r = await testEndpoint("https://a.id/poll");
      expect(r.ok).toBe(true);
      expect(r.latestId).toBe(18);
      expect(r.previewTitle).toBe("DO Baru");
      expect(spy.mock.calls[0][0]).toBe("https://a.id/poll"); // tanpa since_id
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
